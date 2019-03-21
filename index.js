import React, { Component } from 'react';
import {
  TouchableOpacity,
  Keyboard,
  View,
  Text,
  // Clipboard,
  BackHandler,
  Platform,
  PermissionsAndroid,
  Alert,
  Dimensions,
  Linking,
  TextInput,
  // ScrollView,
  // FlatList,
} from 'react-native';
import { iOSColors } from 'react-native-typography';
import { Colors } from '@ui/theme_default';
import { styles } from 'react-native-theme';
import { GiftedChat, Bubble, Send, Composer } from 'react-native-gifted-chat';
import moment from 'moment';
import FastImage from 'react-native-fast-image';
import PropTypes from 'prop-types';
import ImagePicker from 'react-native-image-crop-picker';
import { Actions } from 'react-native-router-flux';
import Tts from 'react-native-tts';
import {
  Screen,
  NavBar,
  Icon,
  Avatar,
  FeatherIcon,
  UploadProgress,
  CustomMessage,
  MessageThread,
} from '@ui/components';
import { AttachAudio, AudioPlay } from '@ui/attachments';
// import DBManager from '../app/DBManager';
import {DBManager} from 'app-module';
import {Application} from '@mongrov/config';
import videoThumbnail from '../../../src/images/videoThumb.jpg';
import VoiceComp from '../../../src/features/comingsoon/VoiceComp';

export default class ChatRoom extends Component {
  constructor(props) {
    super(props);
    const { roomInfo } = props;

    console.disableYellowBox = true;

    this._isMounted = false;
    this._insideStateUpdate = false;
    this.groupId = roomInfo._id;
    this.role = roomInfo.roles;
    this.isOwner = false;
    this.textInputValue = '';

    if (this.role) {
      this.isOwner =
        Object.keys(this.role).length > 0
          ? Object.keys(this.role).some((role) => this.role[role] === 'owner')
          : false;
    }

    if (this.isOwner) {
      this.readOnly = false;
    } else if (roomInfo.readonly) {
      this.readOnly = roomInfo.userMuted;
    } else {
      this.readOnly = false;
    }
  }

  state = {
    messages: [],
    user: {},
    videoConfEnabled: this.readOnly,
    groupInfo: {
      avatarURL: '',
      title: '',
      status: '',
      type: '',
    },
    readOnly: this.readOnly,
    canDelete: false,
    actionsMenu: false,
    attachAudio: false,
    attachAudioBtn: false,
    isIphoneX: false,
    height: 44,
    botVoice: false,
    voiceTextInput: null,
    threadedMsgView: false,
    groupUnreadCount: 0,
  };

  // Lifecycle methods

  componentWillMount() {
    const videoConfEnabled = true;
    const { roomInfo } = this.props;
    this._insideStateUpdate = true;
    this.isIphoneX();

    this.setState({ videoConfEnabled }, () => {
      this._insideStateUpdate = false;
    });

    // audio attachment
    const msgAudio = DBManager.app.getSettingsValue('Message_AudioRecorderEnabled');
    // console.log('MESSAGE AUDIO', msgAudio);
    if (msgAudio && msgAudio.value) {
      this.setState({ attachAudioBtn: true });
    }
    if (roomInfo.name === 'mona' && Application.APPCONFIG.SHOW_BOT_VOICE) {
      this.setState({ botVoice: true });
    }

    // TODO: Method for video conference to be enabled
    // const { videoConf } = this.props;
    // let videoConfEnabled = videoConf(); // settings enabled
    // if (videoConfEnabled) {
    //   if(!this.readOnly){ // either room is read only or user is muted
    //     this.setState({ videoConfEnabled });
    //   }else {
    //     videoConfEnabled = false;
    //   }
    // }
  }

  async componentDidMount() {
    this._isMounted = true;
    const { roomInfo } = this.props;

    DBManager.group.addGroupMessageListner(this.fetchGroupMessages);
    BackHandler.addEventListener('hardwareBackPress', this.handleBackPress);
    const canDelete = await DBManager._taskManager.chat._chatService.canDeleteMessageFromGroup(
      this.groupId,
    );
    this.setState({ canDelete });

    // sending status for non-direct groups which do not receive group.unread
    if (roomInfo && roomInfo.type && (roomInfo.type !== 'd' && roomInfo.unread === 0)) {
      // console.log('SENDING STATUS from didMount');
      DBManager._taskManager.chat.sendReadStatusJob(this.groupId);
    }

    // TTS Listeners for Bot
    if (roomInfo.name === 'mona') {
      DBManager.group.addBotListner(this.botRead);

      Tts.addEventListener('tts-start', (/* event */) => {
        if (this.voiceComp) {
          // this.voiceComp._destroyRecognizer();
          this.voiceComp.setState({ ttsSpeaking: true });
        }
      });
      Tts.addEventListener('tts-finish', (/* event */) => {
        if (this.voiceComp) {
          // this.voiceComp._startRecognizing();
          this.voiceComp.setState({ ttsSpeaking: false });
        }
      });
      Tts.addEventListener('tts-cancel', (/* event */) => {});
    }
  }

  componentWillUnmount = () => {
    const { roomInfo } = this.props;
    this._isMounted = false;

    DBManager.group.removeGroupMessageListener(this.fetchGroupMessages);
    BackHandler.removeEventListener('hardwareBackPress', this.handleBackPress);

    // TTS Clear listeners for Bot
    if (roomInfo.name === 'mona') {
      DBManager.group.removeBotListner();
      Tts.removeEventListener('tts-start');
      Tts.removeEventListener('tts-finish');
      Tts.removeEventListener('tts-cancel');
    }
  };

  componentDidUpdate = (prevProps, prevState) => {
    const { dataToUpload, imageCaption, attachAudio } = this.props;
    if (dataToUpload !== prevProps.dataToUpload) {
      this.uploadMedia(this.groupId, dataToUpload, imageCaption);
    }
    if (attachAudio !== prevState.attachAudio) {
      this.setState({ attachAudio, attachAudioBtn: true });
    }
  };

  onVideoConference() {
    if (Actions.currentScene === 'ChatRoomScene') {
      const { user } = this.state;
      this.startVideoConference();
      Actions.VideoConference({
        groupID: this.groupId,
        userID: user._id,
        instance: DBManager.app.app.host,
      });
    }
  }

  onAudioConference = () => {
    if (Actions.currentScene === 'ChatRoomScene') {
      const { user } = this.state;
      Actions.AudioConference({
        groupID: this.groupId,
        userID: user._id,
        instance: DBManager.app.app.host,
      });
    }
  };

  isIphoneX = () => {
    const d = Dimensions.get('window');
    const { height, width } = d;

    if (Platform.OS === 'ios' && (height === 812 || width === 812)) {
      this.setState({ isIphoneX: true });
    }
  };

  // Android hardware back

  handleBackPress = () => {
    Actions.pop();
    return true;
  };

  checkAudioPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version > 23) {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
    }
  };

  checkPhotoLibraryPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version > 23) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        this.openPhotoLibrary();
      } else {
        Alert.alert('Gallery permission denied');
      }
    } else {
      this.openPhotoLibrary();
    }
  };

  botRead = async (message) => {
    console.log('klklkl', message);
    this.setState({ voiceTextInput: null });
    Tts.speak(message.msg);
  };

  checkVideoConfPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version > 23) {
      const cameraGranted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      const audioGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if ((cameraGranted && audioGranted) === PermissionsAndroid.RESULTS.GRANTED) {
        this.onVideoConference();
      } else {
        Alert.alert('Video Conference permission denied');
      }
    } else {
      this.onVideoConference();
    }
  };

  checkAudioConfPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version > 23) {
      const cameraGranted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      const audioGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if ((cameraGranted && audioGranted) === PermissionsAndroid.RESULTS.GRANTED) {
        this.onAudioConference();
      } else {
        Alert.alert('Audio Conference permission denied');
      }
    } else {
      this.onAudioConference();
    }
  };

  checkCameraPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version > 23) {
      const cameraGranted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      const audioGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if ((cameraGranted && audioGranted) === PermissionsAndroid.RESULTS.GRANTED) {
        this.takePhoto();
      } else {
        Alert.alert('Camera permission denied');
      }
    } else {
      this.takePhoto();
    }
  };

  // Composer and send functions

  onSend = (messages = []) => {
    const { chat } = DBManager._taskManager;
    const { user } = this.state;
    // this.textInputValue = '';
    // this.setState({ voiceTextInput: null });
    // this.gcComp.textInput.clear();
    if (Platform.OS !== 'ios') {
      this.setState({ height: 44, attachAudioBtn: true });
      this.composerRef.clear();
      this.textInputValue = '';
    }
    chat.sendMessageJob(this.groupId, messages[0]);
    chat.sendTypingNotificationJob(this.groupId, user, false);
  };

  onInputTextChanged = (event) => {
    if (event !== '') {
      // prevent sending notification when a user enters a group
      const { chat } = DBManager._taskManager;
      const { user } = this.state;
      chat.sendTypingNotificationJob(this.groupId, user, true);
    }
  };

  // Messages functions

  onLoadEarlier = (groupId) => {
    if (groupId) {
      DBManager._taskManager.chat.loadEarlierMessage(groupId);
    }
  };

  onChangeTextInput = (text) => {
    const textLength = text.trim().length;
    this.setState({ attachAudioBtn: !textLength });
    this.textInputValue = text;
  };

  showMessageInfo = (currentMessage) => {
    Actions.MessageInfo({ messageId: currentMessage._id });
  };

  likeMessage = (messageId) => {
    DBManager._taskManager.chat.setLikeOnMessage(messageId);
  };

  // onLongPress = (context, currentMessage) => {
  //   const { canDelete, user } = this.state;
  //   // console.log('CAN DELETE', canDelete);
  //   const isOwnMessage = currentMessage.user._id === user._id;
  //   Keyboard.dismiss();
  //   if (currentMessage.text && !this.readOnly) {
  //     if (canDelete && isOwnMessage) {
  //       const options = ['Reply', 'Copy Text', 'Message Info', 'Delete', 'Cancel'];
  //       const cancelButtonIndex = options.length - 1;
  //       const destructiveButtonIndex = options.length - 2;
  //       context.actionSheet().showActionSheetWithOptions(
  //         {
  //           options,
  //           cancelButtonIndex,
  //           destructiveButtonIndex,
  //         },
  //         (buttonIndex) => {
  //           switch (buttonIndex) {
  //             case 0:
  //               // this.setReplyMessageId(currentMessage._id);
  //               this.goToReplyMessage(currentMessage);
  //               break;
  //             case 1:
  //               Clipboard.setString(currentMessage.text);
  //               break;
  //             case 2:
  //               this.showMessageInfo(currentMessage);
  //               break;
  //             case 3:
  //               Alert.alert(
  //                 'Delete',
  //                 'Do you want to delete message?',
  //                 [
  //                   { text: 'No', onPress: () => {}, style: 'cancel' },
  //                   {
  //                     text: 'Yes',
  //                     onPress: () =>
  //                       this.deleteMessage(currentMessage._id, currentMessage.user._id),
  //                   },
  //                 ],
  //                 { cancelable: false },
  //               );
  //               break;
  //             default:
  //               break;
  //           }
  //         },
  //       );
  //     } else {
  //       const options = ['Reply', 'Copy Text', 'Message Info', 'Cancel'];
  //       const cancelButtonIndex = options.length - 1;
  //       context.actionSheet().showActionSheetWithOptions(
  //         {
  //           options,
  //           cancelButtonIndex,
  //         },
  //         (buttonIndex) => {
  //           switch (buttonIndex) {
  //             case 0:
  //               // this.setReplyMessageId(currentMessage._id);
  //               this.goToReplyMessage(currentMessage);
  //               break;
  //             case 1:
  //               Clipboard.setString(currentMessage.text);
  //               break;
  //             case 2:
  //               this.showMessageInfo(currentMessage);
  //               break;
  //             default:
  //               break;
  //           }
  //         },
  //       );
  //     }
  //   }
  // };

  setGroupMessagesAsRead = (unreadCount, sendStatus) => {
    const { groupInfo, groupUnreadCount } = this.state;
    const { appState } = DBManager.app;
    // console.log('GROUP HAS UNREAD', unreadCount);
    // console.log('GROUP sendStatus', sendStatus);
    // console.log('APP appState', appState);
    // disable sending read status in background
    if (appState) {
      if (unreadCount && unreadCount !== groupUnreadCount) {
        DBManager._taskManager.chat.sendReadStatusJob(this.groupId);
        this.setState({ groupUnreadCount: unreadCount });
      } else if (!unreadCount && groupInfo.type !== 'd' && sendStatus) {
        DBManager._taskManager.chat.sendReadStatusJob(this.groupId);
      } else if (!unreadCount && unreadCount !== groupUnreadCount) {
        this.setState({ groupUnreadCount: unreadCount });
      }
    }
  };

  // sending status for non-direct groups which do not receive group.unread
  // && while messages-list-view is open
  shouldSendReadStatus = (groupMessages) => {
    const { messages } = this.state;
    let sendStatus = false;
    const oldMsgLength = messages && messages.length;
    const newMsgLength = groupMessages && groupMessages.length;
    // console.log('M-old', oldMsgLength, 'M-new', newMsgLength);
    if (oldMsgLength && newMsgLength) {
      const index = newMsgLength - oldMsgLength;
      if (index > 0) {
        const { loggedInUserId } = DBManager.user;
        const newMessages = groupMessages.slice(0, index);
        sendStatus = newMessages.some((msg) => msg.user._id !== loggedInUserId);
      }
    }
    return sendStatus;
  };

  startVideoConference = () => {
    DBManager._taskManager.chat.startVideoConference(this.groupId);
  };

  fetchGroupMessages = async () => {
    // const { readOnly } = this;
    if (this._isMounted && !this._insideStateUpdate && this.groupId) {
      const groupMessages = await DBManager.group.getGroupMessages(this.groupId);
      const group = await DBManager.group.findById(this.groupId);
      // DBManager.board.findByName(group.name);
      this._insideStateUpdate = true;
      let readOnly = this.isOwner ? false : group.readonly;
      readOnly = readOnly ? group.userMuted : readOnly;
      // console.log('GROUP MESSAGE LENGTH', Array.from(Object.keys(groupMessages)).length);
      // console.log('GROUP MESSAGE LENGTH ', Application.FETCH_CURRENT_GROUP_MIN_MSGS);
      const sendReadStatus = this.shouldSendReadStatus(groupMessages);
      this.setState(
        {
          user: DBManager.user.loggedInUser,
          messages: groupMessages,
          groupInfo: group,
          loadEarlier: group.moreMessages,
          // Array.from(Object.keys(groupMessages)).length >=
          // Application.FETCH_CURRENT_GROUP_MIN_MSGS,
          readOnly,
        },
        () => {
          this._insideStateUpdate = false;
        },
      );
      this.setGroupMessagesAsRead(group.unread, sendReadStatus);
    }
  };

  deleteMessage = (messageId, userId) => {
    // console.log(`User ${userId} selected message ${messageId} to delete`);
    const { user } = this.state;

    // can delete only own messages
    if (userId === user._id) {
      const { chat } = DBManager._taskManager;
      chat.deleteMessageJob(this.groupId, messageId);
    }
  };

  // Navigations from room

  goToRoomInfo = () => {
    const { groupInfo } = this.state;
    Keyboard.dismiss();
    if (groupInfo.type !== 'd') {
      Actions.GroupInfo({
        memberId: this.groupId,
      });
    } else {
      Actions.MemberInfo({
        memberId: this.groupId,
      });
    }
  };

  // Navigations from board task

  goToBoardTask = () => {
    const { groupInfo } = this.state;
    if (groupInfo.type !== 'd') {
      return (
        <TouchableOpacity
          style={[styles.navSideButtonDimension, styles.alignJustifyCenter]}
          onPress={() => {
            Keyboard.dismiss();
            if (Actions.currentScene === 'ChatRoomScene') {
              Actions.GroupTasksList({
                boardName: groupInfo.title,
                groupId: this.groupId,
              });
            }
          }}
        >
          <Icon
            name="file-document-outline"
            type="material-community"
            color={Colors.NAV_ICON}
            size={24}
          />
        </TouchableOpacity>
      );
    }
  };

  goToTimeTable = () => {
    const { groupInfo } = this.state;
    if (groupInfo.type !== 'd') {
      return (
        <TouchableOpacity
          style={[styles.navSideButtonDimension, styles.alignJustifyCenter]}
          onPress={() => {
            Keyboard.dismiss();
            if (Actions.currentScene === 'ChatRoomScene') {
              Actions.Timeline({
                calendarName: groupInfo.name,
                calendarUrl: groupInfo.calender,
              });
            }
          }}
        >
          <Icon name="timetable" type="material-community" color={Colors.NAV_ICON} size={24} />
        </TouchableOpacity>
      );
    }
  };

  goToReplyMessage = (replyMessage) => {
    const { groupInfo, messages, user, canDelete } = this.state;
    if (replyMessage && replyMessage._id) {
      Actions.ReplyMessage({
        group: groupInfo,
        user,
        messages,
        replyMessage,
        canDelete,
      });
    }
  };

  CameraSuccess = (roomInfo, dataToUpload, imageCaption) => {
    if (roomInfo) {
      Actions.popTo('ChatRoomScene');
      setTimeout(() => Actions.refresh({ roomInfo, dataToUpload, imageCaption }));
    } else {
      Actions.Chat();
    }
  };

  // File upload functions

  uploadMedia = (groupId, dataToUpload, imageCaption) => {
    const { chat } = DBManager._taskManager;
    const isImage = !dataToUpload.uri.endsWith('mp4');
    chat.uploadMediaJob(dataToUpload, groupId, isImage, imageCaption);
  };

  toggleActionsMenu = () => {
    const { actionsMenu } = this.state;
    this.setState({ actionsMenu: !actionsMenu });
  };

  // Render methods for components

  renderTick = (currentMessage) => {
    const { user } = this.state;
    const { user: messageUser, status } = currentMessage;
    if (messageUser._id !== user._id) {
      return null;
    }
    if (status > 0) {
      return (
        <View style={[styles.rowDirection, styles.marginRight8]}>
          {status <= 100 && <Text style={styles.chatDetailTickMark}>✓</Text>}
          {status === 100 && <Text style={styles.chatDetailTickMark}>✓</Text>}
        </View>
      );
    }
    return null;
  };

  renderTime = (props) => (
    <View style={[styles.rowDirection, { marginBottom: 5, marginHorizontal: 10 }]}>
      <Text
        style={[
          styles.fontSize12,
          { color: props.position === 'left' ? Colors.TEXT_LEFT_TIME : Colors.TEXT_RIGHT_TIME },
        ]}
      >
        {moment(props.currentMessage.createdAt).format('LT')}
      </Text>
    </View>
  );

  renderBubble = (props) => {
    let displayName = false;
    let attachmentMessageLoading = false;
    const { status, image, remoteFile /* , isReply */ } = props.currentMessage;
    const hasAttachment = image || remoteFile;
    // const { status, remoteFile, attachement, image } = props.currentMessage;
    // console.log('kkkk', status, remoteFile, attachement, image);
    if (props.position === 'left') {
      if (
        !(
          props.isSameUser(props.currentMessage, props.previousMessage) &&
          props.isSameDay(props.currentMessage, props.previousMessage)
        )
      ) {
        displayName = true;
      }
    }

    if (hasAttachment && props.position === 'right' && status === 0) {
      attachmentMessageLoading = true;
    }

    // deleted messages(status === -1) removed immediately
    if (status === -1) {
      return null;
    }

    return (
      <View>
        {displayName && (
          <Text style={[styles.chatDetailUserName]}>{props.currentMessage.user.name}</Text>
        )}
        <Bubble
          {...props}
          wrapperStyle={{
            left: styles.chatDetailLeftBubble,
            right: attachmentMessageLoading
              ? [styles.chatDetailRightBubble, { backgroundColor: iOSColors.lightGray }]
              : styles.chatDetailRightBubble,
          }}
          textStyle={{
            left: styles.chatDetailBubbleLeftText,
            right: styles.chatDetailBubbleRightText,
          }}
          renderTicks={this.renderTick}
          renderTime={this.renderTime}
          renderCustomView={(_props) => this.renderFileAttachment(_props)}
          // renderMessageText={isReply ? this.renderReply : null}
        />
      </View>
    );
  };

  renderMessageImage = (props) => {
    const { status, image, uploadFilePercent } = props.currentMessage;
    const { canDelete } = this.state;
    const imageURI = status > 0 ? image : '';
    // console.log(`Status ${status}, image ${image}, percentage ${uploadFilePercent}`);
    return (
      <TouchableOpacity
        onPress={() => {
          // do not show preview for un-uploaded image
          if (Actions.currentScene === 'ChatRoomScene' && status > 0) {
            this.setState({ actionsMenu: false });
            Actions.ViewImage({
              imageUrl: props.currentMessage.image,
              goBack: () => Actions.pop,
              deleteMessage: () =>
                this.deleteMessage(props.currentMessage._id, props.currentMessage.user._id),
              showDelete: canDelete,
            });
          }
        }}
        style={{ padding: 3 }}
      >
        {status === 0 &&
          uploadFilePercent >= 0 && <UploadProgress uploadFilePercent={uploadFilePercent} />}

        <FastImage
          style={styles.chatDetailImageMessageView}
          source={{
            uri: imageURI,
            priority: FastImage.priority.high,
          }}
        />
      </TouchableOpacity>
    );
  };

  // renderReply = (props) => {
  //   const { replyMessageId } = props.currentMessage;
  //   const replyMessageObj = DBManager.group.findMessageById(replyMessageId);
  //   // const { canDelete } = this.state;

  //   // console.log('REPLY MESSAGE ID, OBJ', replyMessageId, replyMessageObj);
  //   if (replyMessageId && replyMessageObj) {
  //     const { user, text, image } = replyMessageObj;
  //     const sideColor = props.position === 'left' ? Colors.TEXT_DARK : Colors.TEXT_REPLY_RIGHT;
  //     return (
  //       <View style={styles.flex1}>
  //         <View style={styles.threadedMessageContainer}>
  //           <View style={styles.threadedMessageView}>
  //             <Text
  //               style={[styles.threadedMessageText, { color: sideColor }]}
  //               numberOfLines={1}
  //             >{`${user.name || user.username}:`}</Text>
  //             <Text style={{ color: sideColor }}>{text}</Text>
  //           </View>
  //           {image && (
  //             <TouchableOpacity
  //               onPress={() => {
  //                 if (Actions.currentScene === 'ChatRoomScene') {
  //                   this.setState({ actionsMenu: false });
  //                   Actions.ViewImage({
  //                     imageUrl: image,
  //                     goBack: () => Actions.pop,
  //                     // deleteMessage: () =>
  //                     //   this.deleteMessage(props.currentMessage._id, props.currentMessage.user._id),
  //                     // showDelete: canDelete,
  //                   });
  //                 }
  //               }}
  //               style={styles.padding3}
  //             >
  //               <FastImage
  //                 style={styles.threadedMessageImage}
  //                 source={{
  //                   uri: image,
  //                   priority: FastImage.priority.high,
  //                 }}
  //               />
  //             </TouchableOpacity>
  //           )}
  //         </View>
  //         <MessageText {...props} />
  //       </View>
  //     );
  //   }
  //   if (replyMessageId && !replyMessageObj) {
  //     return <MessageText {...props} />;
  //   }
  // };

  renderMessageText = (props) => {
    const { canDelete, user } = this.state;
    const { currentMessage } = props;
    const isSameUser = user && currentMessage.user && user._id === currentMessage.user._id;
    const videoColor = !isSameUser ? Colors.VIDEO_BUTTON : Colors.TEXT_WHITE;
    if (currentMessage.type === 4) {
      return (
        <TouchableOpacity
          style={[styles.joinCallButton]}
          onPress={async () => {
            await this.checkVideoConfPermission();
            this.setState({ actionsMenu: false });
          }}
        >
          <Text style={{ color: videoColor, marginRight: 5, fontSize: 16 }}>
            {currentMessage.text}
          </Text>
          <Icon name="message-video" type="material-community" color={videoColor} size={20} />
        </TouchableOpacity>
      );
    }
    if (currentMessage.type !== 4) {
      return (
        <CustomMessage
          {...props}
          canDelete={canDelete}
          replyMessage={this.goToReplyMessage}
          messageInfo={this.showMessageInfo}
          deleteMessage={this.deleteMessage}
          likeMessage={this.likeMessage}
          isSameUser={isSameUser}
        />
      );
    }
  };

  renderAvatar = (props) => (
    <View style={styles.marginRight6}>
      <Avatar
        // statusColor={item.type === 'd' ? statusColor : 'transparent'}
        avatarUrl={`${Application.urls.SERVER_URL}/avatar/${
          props.currentMessage.user.username
        }?_dc=undefined`}
        avatarName={props.currentMessage.user.name}
        key={props.currentMessage.user.avatar}
        avatarSize={30}
        onAvatarPress={() => Actions.MemberInfo({ eachmemberId: props.currentMessage.user._id })}
      />
    </View>
  );

  renderChatFooter = () => {
    const { actionsMenu, voiceTextInput } = this.state;
    if (actionsMenu) {
      return (
        <View style={styles.chatDetailFooterContainer}>
          <TouchableOpacity
            style={styles.chatDetailFooterContentButton}
            onPress={async () => {
              if (Actions.currentScene === 'ChatRoomScene') {
                await this.checkPhotoLibraryPermission();
              }
            }}
          >
            <View style={[styles.chatDetailFooterIconView, { backgroundColor: iOSColors.blue }]}>
              <FeatherIcon name="image" color={Colors.TEXT_WHITE} size={30} />
            </View>
            <Text style={styles.fontSize12}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chatDetailFooterContentButton}
            onPress={async () => {
              if (Actions.currentScene === 'ChatRoomScene') {
                await this.checkCameraPermission();
              }
            }}
          >
            <View
              style={[styles.chatDetailFooterIconView, { backgroundColor: iOSColors.tealBlue }]}
            >
              <FeatherIcon name="camera" color={Colors.TEXT_WHITE} size={30} />
            </View>
            <Text style={styles.fontSize12}>Camera</Text>
          </TouchableOpacity>
          {Application.APPCONFIG.ATTACH_VIDEO && (
            <TouchableOpacity
              style={styles.chatDetailFooterContentButton}
              onPress={async () => {
                if (Actions.currentScene === 'ChatRoomScene') {
                  this.pickVideosFromGallery();
                }
              }}
            >
              <View style={[styles.chatDetailFooterIconView, { backgroundColor: iOSColors.blue }]}>
                <FeatherIcon name="video" color={Colors.TEXT_WHITE} size={30} />
              </View>
              <Text style={styles.fontSize12}>Videos</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    if (voiceTextInput) {
      return (
        <View style={styles.chatDetailFooterContainer}>
          <Text style={styles.cListTitle}>{voiceTextInput}</Text>
        </View>
      );
    }
  };

  renderActions = () => (
    <TouchableOpacity
      style={{
        width: 45,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onPress={this.toggleActionsMenu}
    >
      <FeatherIcon name="plus-circle" color={iOSColors.gray} size={30} />
    </TouchableOpacity>
  );

  renderSend = (props) => {
    const { attachAudioBtn, botVoice } = this.state;
    if (Platform.OS === 'ios' && props.text.trim().length > 0) {
      return (
        <Send {...props} containerStyle={[styles.alignJustifyCenter, styles.marginRight5]}>
          <View style={[styles.chatDetailSendView, styles.alignJustifyCenter]}>
            <Icon name="send" color={Colors.TEXT_HEADER} size={28} />
          </View>
        </Send>
      );
    }
    if (!attachAudioBtn) {
      return (
        <Send
          {...props}
          text={this.textInputValue}
          containerStyle={[styles.alignJustifyCenter, styles.marginRight5]}
        >
          <View style={[styles.chatDetailSendView, styles.alignJustifyCenter]}>
            <Icon name="send" color={Colors.TEXT_HEADER} size={28} />
          </View>
        </Send>
      );
    }
    if (/* textLength === 0 && */ attachAudioBtn && Application.APPCONFIG.ATTACH_AUDIO) {
      if (!botVoice) {
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity
              style={[styles.alignJustifyCenter, styles.chatDetailAudioButtonDimension]}
              onPress={async () => {
                Keyboard.dismiss();
                await this.checkAudioPermission();
                this.setState({
                  actionsMenu: false,
                  attachAudio: true,
                });
              }}
            >
              <Icon
                name="microphone"
                type="material-community"
                size={30}
                color={Colors.TEXT_HEADER}
              />
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <VoiceComp
            // eslint-disable-next-line
            onRef={(ref) => (this.voiceComp = ref)}
            sendVoiceText={this.sendVoiceText}
            sendResults={this.updateVoiceText}
            stopVoice={this.stopVoice}
          />
        </View>
      );
    }
  };

  // renderFooter = () => {
  //   const { attachAudio } = this.state;
  //   return attachAudio ? <AttachAudio /> : null;
  // };

  renderAudioRecorder = () => <AttachAudio />;

  renderFileAttachment = (props) => {
    const { position } = props;
    const { status, remoteFile, remoteFileType, type, uploadFilePercent } = props.currentMessage;
    const { canDelete } = this.state;
    const filePath = status > 0 ? remoteFile : '';
    const showPlayer = status > 0;
    const playerThumbnail = status > 0 ? videoThumbnail : { uri: '' };

    if (remoteFile && (type === 3 || (remoteFileType && remoteFileType.startsWith('audio')))) {
      return (
        <TouchableOpacity style={styles.padding3}>
          {status === 0 &&
            uploadFilePercent >= 0 && <UploadProgress uploadFilePercent={uploadFilePercent} />}

          <AudioPlay
            audioFile={filePath}
            showPlayer={showPlayer}
            showDelete={canDelete}
            position={position}
            deleteMessage={() =>
              this.deleteMessage(props.currentMessage._id, props.currentMessage.user._id)
            }
          />
        </TouchableOpacity>
      );
    }
    if (remoteFile && (type === 2 || (remoteFileType && remoteFileType.startsWith('video')))) {
      return (
        <TouchableOpacity
          style={styles.padding3}
          onPress={() => {
            // do not show preview for un-uploaded video
            if (Actions.currentScene === 'ChatRoomScene' && status > 0) {
              this.setState({ actionsMenu: false });
              Keyboard.dismiss();
              Actions.VideoPreview({
                videoUrl: filePath,
                deleteMessage: () =>
                  this.deleteMessage(props.currentMessage._id, props.currentMessage.user._id),
                showDelete: canDelete,
              });
            }
          }}
        >
          {status === 0 &&
            uploadFilePercent >= 0 && <UploadProgress uploadFilePercent={uploadFilePercent} />}

          <FastImage style={styles.chatDetailImageMessageView} source={playerThumbnail}>
            <View
              style={{
                position: 'absolute',
                width: '100%',
                top: '35%',
                left: 0,
                right: 0,
                flex: 1,
                alignItems: 'center',
              }}
            >
              {status > 0 && (
                <Icon name="play-circle" type="material-community" size={48} color="#000" />
              )}
            </View>
          </FastImage>
        </TouchableOpacity>
      );
    }
    return null;
  };

  renderComposer = (props) => {
    const { height } = this.state;
    const inputHeight = Math.min(120, Math.max(44, height));
    // uncontrolled text input for Android
    if (Platform.OS !== 'ios') {
      return (
        <View style={styles.composerContainerAndroid}>
          <TextInput
            multiline
            placeholder="Type a message..."
            placeholderTextColor={Colors.TYP_MIDGRAY}
            style={[styles.composerInput, { height: inputHeight }]}
            onContentSizeChange={(event) => {
              this.setState({
                height: event.nativeEvent.contentSize.height,
              });
            }}
            // value={text}
            // onChangeText={(text) => this.setState({ text })}
            underlineColorAndroid={Colors.TRANSPARENT}
            disableFullscreenUI={true}
            ref={(component) => {
              this.composerRef = component;
            }}
            onChangeText={(text) => this.onChangeTextInput(text)}
            onChange={() => this.setState({ attachAudioBtn: false })}
            onFocus={() => this.setState({ actionsMenu: false })}
          />
        </View>
      );
    }
    // default composer for ios
    return <Composer {...props} />;
  };

  sendVoiceText = (msg) => {
    const { chat } = DBManager._taskManager;
    chat.sendMessageJob(this.groupId, { text: msg });
    // this.setState({ voiceTextInput: null });
  };

  updateVoiceText = (res) => {
    this.setState({ voiceTextInput: res });
  };

  stopVoice = () => {
    Tts.stop();
  };

  // Camera

  openImagePreview = (dataToUpload) => {
    Actions.ImagePreview({
      imageUrl: dataToUpload.uri,
      onSuccessAction: (imageCaption) => {
        Actions.pop();
        setTimeout(() => {
          Actions.refresh({
            dataToUpload,
            imageCaption,
          });
        }, 0);
      },
    });
  };

  takePhoto = async () => {
    this.toggleActionsMenu();
    Actions.CameraScreen();
    // try {
    //   const image = await ImagePicker.openCamera(imagePickerConfig);
    //   const { path, height, width } = image;
    //   const dataToUpload = { uri: path, height, width };
    //   this.openImagePreview(dataToUpload);
    // } catch (e) {
    //   // log('takePhoto', e);
    // }
  };

  openPhotoLibrary = async () => {
    this.toggleActionsMenu();
    Actions.PhotoLibrary();
    // try {
    //   const image = await ImagePicker.openPicker(imagePickerConfig);
    //   const { path, height, width } = image;
    //   const dataToUpload = { uri: path, height, width };
    //   this.openImagePreview(dataToUpload);
    // } catch (e) {
    //   // log('takePhoto', e);
    // }
  };

  pickVideosFromGallery = () => {
    this.toggleActionsMenu();
    ImagePicker.openPicker({
      multiple: true,
      waitAnimationEnd: false,
      // includeExif: true,
      mediaType: 'video',
      maxFiles: 1,
    }).then((videos) => {
      // console.log('received video 1', videos);
      Actions.refresh({
        dataToUpload: { uri: videos[0].path, size: videos[0].size },
        imageCaption: 'Video Message',
      });
    });
    // .catch((error) => console.log('PICK VIDEOS ERROR', error));
  };

  renderReadOnly = () => (
    <View
      style={{
        flexDirection: 'row',
        marginBottom: 10,
      }}
    >
      <View style={{ width: 120 }} />
      {/* <FontAwesome5Icon
          name="user-circle"
          color={Colors.BG_PRIMARY}
          size={24}

            />  */}
      <Text style={{ fontWeight: 'bold', color: Colors.BG_PRIMARY }}> Read only channel</Text>
    </View>
  );
  // Main render method

  render() {
    const {
      user,
      videoConfEnabled,
      groupInfo: chatDetail,
      messages: chatMessages,
      loadEarlier,
      readOnly,
      isIphoneX,
      attachAudio,
      threadedMsgView,
    } = this.state;

    // Dummydata for threadedMsg
    // const DummyData = [
    //   {
    //     id: '01',
    //     name: 'Jhon',
    //     text: 'Mongrov is a communication & collaboration tool with capabilities of integrations',
    //     commentCount: '5',
    //     member: 'Dwayne,David,Jancy',
    //     lastMsg: {
    //       name: 'Dwayne',
    //       text: 'good',
    //       time: '1 hours ago',
    //     },
    //   },
    //   {
    //     id: '02',
    //     name: 'David',
    //     imageUrl: 'https://assets.digitalocean.com/ghost/2018/09/Custom-Images-Blog-Header.png',
    //     text: 'An engagement and personalization platform to streamline business processes.',
    //     commentCount: '3',
    //     member: 'Jhon,Dwayne,Jancy',
    //     lastMsg: {
    //       name: 'Dwayne',
    //       text: 'good work',
    //       time: '2 hours ago',
    //     },
    //   },
    //   {
    //     id: '03',
    //     name: 'Jancy',
    //     imageUrl: 'https://mongrov.com/images/award.png',
    //     text: 'Join LinkedIn today for free. See who you know at Mongrov, Inc.',
    //     commentCount: '10',
    //     member: 'Dwayne,Jhon,David',
    //     lastMsg: {
    //       name: 'Ram',
    //       text: 'good job',
    //       time: '3 hours ago',
    //     },
    //   },
    // ];
    // console.log('viswanth-chatDetail', chatDetail);

    // const ann = chatDetail && chatDetail.announcement ? true : false;
    const ann = !!(chatDetail && chatDetail.announcement);

    return (
      <View style={{ flex: 1 }}>
        <Screen>
          <NavBar
            leftComponent={
              <TouchableOpacity
                style={[styles.navSideButtonDimension, styles.alignJustifyCenter]}
                onPress={() => {
                  if (Actions.currentScene === 'ChatRoomScene') {
                    Actions.pop();
                  }
                }}
              >
                <Icon
                  name="chevron-left"
                  type="material-community"
                  color={Colors.NAV_ICON}
                  size={36}
                />
              </TouchableOpacity>
            }
            rightComponent={
              !videoConfEnabled || !Application.APPCONFIG.ATTACH_VIDEOCONF ? null : (
                <View style={[styles.rowDirection, styles.paddingRight10]}>
                  {user && (
                    <View style={[styles.rowDirection, { alignItems: 'baseline' }]}>
                      {!Application.APPCONFIG.ATTACH_THREADEDCHAT ? null : (
                        <TouchableOpacity
                          style={[styles.navSideButtonDimension, styles.alignJustifyCenter]}
                          onPress={() => {
                            this.setState({
                              threadedMsgView: !threadedMsgView,
                            });
                          }}
                        >
                          {!threadedMsgView && (
                            <Icon
                              name="message-text-outline"
                              type="material-community"
                              color={Colors.NAV_ICON}
                              size={23}
                            />
                          )}
                          {threadedMsgView && (
                            <Icon
                              name="message-text"
                              type="material-community"
                              color={Colors.NAV_ICON}
                              size={23}
                            />
                          )}
                        </TouchableOpacity>
                      )}
                      {!Application.APPCONFIG.HIDE_TIME_TABLE && chatDetail.calender !== null
                        ? this.goToTimeTable()
                        : null}
                      {Application.APPCONFIG.SHOW_GROUP_TASKS ? this.goToBoardTask() : null}
                      {(!Application.APPCONFIG.HIDE_AUDIO_CONF && (
                        <TouchableOpacity
                          style={[styles.navSideButtonDimension, styles.alignJustifyCenter]}
                          onPress={async () => {
                            await this.checkAudioConfPermission();
                            this.setState({ actionsMenu: false });
                          }}
                        >
                          <FeatherIcon
                            name="phone"
                            type="material-community"
                            color={Colors.NAV_ICON}
                            size={24}
                          />
                        </TouchableOpacity>
                      )) ||
                        null}
                      <TouchableOpacity
                        style={[styles.navSideButtonDimension, styles.alignJustifyCenter]}
                        onPress={async () => {
                          await this.checkVideoConfPermission();
                          this.setState({ actionsMenu: false });
                        }}
                      >
                        <FeatherIcon
                          name="video"
                          type="material-community"
                          color={Colors.NAV_ICON}
                          size={26}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )
            }
            onChatNavPress={() => {
              if (Actions.currentScene === 'ChatRoomScene') {
                this.setState({ actionsMenu: false });
                this.goToRoomInfo();
              }
            }}
            avatarUrl={chatDetail.avatarURL}
            avatarName={chatDetail.name}
            avatarSize={30}
            chatTitle={chatDetail.name}
            chatInfo={chatDetail.status}
            chatSubTitle={chatDetail.title}
            type={chatDetail.type}
            navContainerStyle={{
              position: 'relative',
              top: 0,
              right: 0,
              left: 0,
              zIndex: 999,
            }}
          />
          {ann && <Text style={[styles.announcement]}>{chatDetail.announcement}</Text>}
          {user &&
            !threadedMsgView && (
              <View
                style={[styles.flex1, styles.chatDetailContainer]}
                onStartShouldSetResponder={() => this.setState({ actionsMenu: false })}
              >
                <GiftedChat
                  messages={chatMessages}
                  onSend={(messages) => this.onSend(messages)}
                  // ref={(element) => {
                  //   this.gcComp = element;
                  // }}
                  // eslint-disable-next-line
                  // text={this.state.voiceTextInput ? this.state.voiceTextInput : ''}
                  // onLongPress={(context, currentMessage) => this.onLongPress(context, currentMessage)}
                  onLongPress={() => {}} // onLongPress disabled
                  // onInputTextChanged={(event) => this.onInputTextChanged(event)}
                  user={{
                    _id: user._id,
                    // avatar: this.state.user.avatar,
                  }}
                  keyboardShouldPersistTaps="handled"
                  isAnimated={true}
                  // Renders
                  renderAvatarOnTop={true}
                  renderBubble={(props) => this.renderBubble(props)}
                   // renderAvatar={this.renderAvatar}
                  renderMessageImage={this.renderMessageImage}
                  renderMessageText={this.renderMessageText}
                  // renderFooter={this.renderFooter}
                  renderSend={readOnly ? () => null : this.renderSend}
                  renderActions={readOnly ? () => null : this.renderActions}
                  // renderInputToolbar={this.renderInputToolbar}
                  renderChatFooter={this.renderChatFooter}
                  renderInputToolbar={attachAudio ? this.renderAudioRecorder : null}
                  // minInputToolbarHeight={100}
                  renderComposer={
                    readOnly ? () => this.renderReadOnly() : (props) => this.renderComposer(props)
                  }
                  alwaysShowSend={true}
                  bottomOffset={isIphoneX ? 30 : 0}
                  textInputStyle={styles.chatDetailTextInput}
                  containerStyle={{
                    backgroundColor: Colors.BG_CHAT_DETAIL,
                    borderTopWidth: 0,
                    paddingTop: 3,
                  }}
                  loadEarlier={loadEarlier}
                  onLoadEarlier={() => this.onLoadEarlier(this.groupId)}
                  parsePatterns={(linkStyle) => [
                    {
                      type: 'url',
                      style: { ...linkStyle, color: Colors.TEXT_BLUE },
                      onPress: (url) => {
                        Linking.openURL(url).catch(() =>
                          /* err */ Alert.alert('Sorry cannot open this url'),
                        );
                      },
                    },
                  ]}
                />
              </View>
            )}
          {threadedMsgView && (
            <MessageThread group={chatDetail} user={user} messages={chatMessages} />
          )}
        </Screen>
      </View>
    );
  }
}

ChatRoom.propTypes = {
  groupId: PropTypes.string,
  groupInfo: PropTypes.object,
  roomInfo: PropTypes.object,
  dataToUpload: PropTypes.object,
  muted: PropTypes.bool,
  role: PropTypes.oneOfType([PropTypes.instanceOf(Array), PropTypes.object]),
  // attachAudio: PropTypes.bool,
};

ChatRoom.defaultProps = {
  groupId: '',
  groupInfo: {},
  dataToUpload: {},
  muted: false,
  roomInfo: {},
  role: {},
  // attachAudio: false,
};
