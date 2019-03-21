import React from 'react';
import renderer from 'react-test-renderer';
import { shallow, configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import { Actions } from 'react-native-router-flux';
import {
  Dimensions,
  BackHandler,
  PermissionsAndroid,
  View,
  Alert,
  Keyboard,
  Linking,
} from 'react-native';
import { Colors } from '@ui/theme_default';
import DbManager from '../../app/DBManager';
import Application from '../../constants/config';
import ChatRoom from '../index';

configure({ adapter: new Adapter() });

jest.mock('react-native-router-flux', () => ({
  Actions: {
    currentScene: 'ChatRoomScene',
    pop: jest.fn(),
    popTo: jest.fn(),
    refresh: jest.fn(),
    CameraScreen: jest.fn(),
    PhotoLibrary: jest.fn(),
    ViewImage: jest.fn(),
    MessageInfo: jest.fn(),
    VideoConference: jest.fn(),
    AudioConference: jest.fn(),
    GroupInfo: jest.fn(),
    MemberInfo: jest.fn(),
    GroupTasksList: jest.fn(),
    ReplyMessage: jest.fn(),
    Chat: jest.fn(),
    VideoPreview: jest.fn(),
    ImagePreview: jest.fn(),
    Timeline: jest.fn(),
  },
}));

jest.mock('Dimensions', () => ({
  get: () => ({ width: 720, height: 360 }),
}));

jest.mock('Keyboard', () => ({
  dismiss: jest.fn(),
}));

jest.mock('Linking', () => ({
  openURL: jest.fn(() => Promise.resolve('url')),
}));

jest.mock('BackHandler', () => {
  const backHandler = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  return backHandler;
});

jest.mock('PermissionsAndroid', () => {
  const permissionsAndroid = {
    requestMultiple: jest.fn(() => Promise.resolve(true)),
    request: jest.fn(() => Promise.resolve(true)),
    PERMISSIONS: {
      CAMERA: true,
      READ_EXTERNAL_STORAGE: true,
      RECORD_AUDIO: true,
      WRITE_EXTERNAL_STORAGE: true,
    },
    RESULTS: {
      GRANTED: true,
    },
  };
  return permissionsAndroid;
});

jest.mock('../../app/DBManager', () => {
  const dbManager = {
    group: {
      findRootMessage: jest.fn(),
      addGroupMessageListner: jest.fn(),
      removeGroupMessageListener: jest.fn(),
      findMessageById: jest.fn(),
      getGroupMessages: jest.fn(),
    },
    _taskManager: {
      chat: {
        sendMessageJob: jest.fn(),
        sendTypingNotificationJob: jest.fn(),
        deleteMessageJob: jest.fn(),
        sendReadStatusJob: jest.fn(),
        loadEarlierMessage: jest.fn(),
        setLikeOnMessage: jest.fn(),
        uploadMediaJob: jest.fn(),
        _chatService: {
          canDeleteMessageFromGroup: jest.fn(() => Promise.resolve(true)),
        },
      },
    },
    app: {
      getSettingsValue: jest.fn(() => ({ settings: 'audio' })),
      app: { host: 'mongrov.com' },
    },
    user: {
      loggedInUser: { _id: 'MM1258g51dF92', name: 'dreaming-dev' },
      loggedInUserId: 'MM1258g51dF92',
    },
  };
  return dbManager;
});

jest.mock('Alert', () => ({
  alert: jest.fn((str1, str2, arr) => {
    arr[0].onPress();
  }),
}));

jest.mock('../../constants/config', () => ({
  APPCONFIG: {
    ATTACH_AUDIO: true,
    ATTACH_VIDEO: true,
  },
  urls: {
    SERVER_URL: '',
  },
}));

jest.mock('react-native-image-crop-picker', () => ({
  openPicker: jest.fn(() =>
    Promise.resolve([
      {
        path: '//videos/recording-125.mp4',
        size: 2048,
      },
    ]),
  ),
}));

const groupId = 'XO12T8PE791l';
const groupInfo = {
  _id: 'XO12T8PE791l',
  name: 'unit-test',
};
const roomInfo = {
  _id: 'XO12T8PE791l',
  name: 'unit-test',
};
const dataToUpload = {};
const muted = false;
const role = ['admin'];
const props = { groupId, groupInfo, roomInfo, dataToUpload, muted, role };

jest.useFakeTimers();

beforeEach(() => {
  jest.resetModules();
});

/* ------------------------- Snapshots ----------------------- */

it('ChatMessageList renders correctly without props', () => {
  const tree = renderer.create(<ChatRoom />).toJSON();
  expect(tree).toMatchSnapshot();
});

it('ChatMessageList renders correctly with props', () => {
  const tree = renderer.create(<ChatRoom {...props} />).toJSON();
  expect(tree).toMatchSnapshot();
});

/* ------------------- lifeCycle methods --------------------- */
it('ChatMessageList - roomInfo has no owner role', () => {
  roomInfo.roles = ['moderator', 'user'];
  const tree = shallow(<ChatRoom {...props} roomInfo={roomInfo} />);
  const instance = tree.instance();
  expect(instance.role).toEqual(roomInfo.roles);
  expect(instance.isOwner).toBe(false);
});

it('ChatMessageList - roomInfo has an owner role', () => {
  roomInfo.roles = ['owner'];
  const tree = shallow(<ChatRoom {...props} roomInfo={roomInfo} />);
  const instance = tree.instance();
  expect(instance.role).toEqual(roomInfo.roles);
  expect(instance.isOwner).toBe(true);
  expect(instance.readOnly).toBe(false);
});

it('ChatMessageList - roomInfo has no roles', () => {
  roomInfo.roles = [];
  const tree = shallow(<ChatRoom {...props} roomInfo={roomInfo} />);
  const instance = tree.instance();
  expect(instance.role).toEqual(roomInfo.roles);
  expect(instance.isOwner).toBe(false);
});

it('ChatMessageList - group is readOnly', () => {
  roomInfo.readonly = true;
  roomInfo.userMuted = true;
  const tree = shallow(<ChatRoom {...props} roomInfo={roomInfo} />);
  const instance = tree.instance();
  expect(instance.readOnly).toBe(true);
});

it('ChatMessageList - group is not readOnly', () => {
  roomInfo.readOnly = false;
  roomInfo.userMuted = false;
  const tree = shallow(<ChatRoom {...props} roomInfo={roomInfo} />);
  const instance = tree.instance();
  expect(instance.readOnly).toBe(false);
});

it('ChatMessageList - componentWillMount', () => {
  DbManager.app.getSettingsValue = jest.fn(() => ({ value: 123456 }));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  expect(tree.state().videoConfEnabled).toBe(true);
  expect(tree.state().attachAudioBtn).toBe(true);
  expect(instance._insideStateUpdate).toBe(false);
});

it('ChatMessageList - componentDidMount', async () => {
  roomInfo.type = 'p';
  roomInfo.unread = 0;
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  DbManager._taskManager.chat.sendReadStatusJob.mockClear();
  DbManager._taskManager.chat._chatService.canDeleteMessageFromGroup.mockClear();
  await instance.componentDidMount();
  expect(tree.state().canDelete).toBe(true);
  expect(DbManager._taskManager.chat.sendReadStatusJob).toBeCalled();
  expect(DbManager._taskManager.chat._chatService.canDeleteMessageFromGroup).toBeCalled();
  expect(DbManager.group.addGroupMessageListner).toBeCalled();
  expect(BackHandler.addEventListener).toBeCalled();
});

it('ChatMessageList - componentWillUnmount', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  tree.unmount();
  expect(instance._isMounted).toBe(false);
  expect(DbManager.group.removeGroupMessageListener).toBeCalled();
  expect(BackHandler.removeEventListener).toBeCalled();
});

it('ChatMessageList - componentDidUpdate', () => {
  const prevProps = { dataToUpload: null };
  const prevState = { attachAudio: false };
  const newDataToUpload = {
    dataToUpload: {
      uri: '//Camera/album1/image01-02-03.jpg',
      size: '800x600',
    },
  };
  const tree = shallow(<ChatRoom {...props} dataToUpload={newDataToUpload} />);
  tree.setProps({ attachAudio: true });
  const instance = tree.instance();
  instance.uploadMedia = jest.fn();
  instance.componentDidUpdate(prevProps, prevState);
  expect(instance.uploadMedia).toBeCalled();
  expect(tree.state().attachAudio).toBe(true);
  expect(tree.state().attachAudioBtn).toBe(true);
});

/* ------------------- component methods --------------------- */

it('ChatMessageList calls onVideoConference - from a current scene', () => {
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ user: DbManager.user.loggedInUser });
  const instance = tree.instance();
  instance.startVideoConference = jest.fn();
  Actions.VideoConference.mockClear();
  instance.onVideoConference();
  expect(instance.startVideoConference).toBeCalled();
  expect(Actions.VideoConference).toBeCalledWith({
    groupID: groupId,
    userID: DbManager.user.loggedInUser._id,
    instance: DbManager.app.app.host,
  });
});

it('ChatMessageList calls onVideoConference - from a other scene', () => {
  Actions.currentScene = 'NewsScene';
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.startVideoConference = jest.fn();
  Actions.VideoConference.mockClear();
  instance.onVideoConference();
  expect(instance.startVideoConference).not.toBeCalled();
  expect(Actions.VideoConference).not.toBeCalled();
});

it('ChatMessageList calls onAudioConference - from a current scene', () => {
  Actions.currentScene = 'ChatRoomScene';
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ user: DbManager.user.loggedInUser });
  const instance = tree.instance();
  Actions.AudioConference.mockClear();
  instance.onAudioConference();
  expect(Actions.AudioConference).toBeCalledWith({
    groupID: groupId,
    userID: DbManager.user.loggedInUser._id,
    instance: DbManager.app.app.host,
  });
});

it('ChatMessageList calls onAudioConference - from a other scene', () => {
  Actions.currentScene = 'NewsScene';
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  Actions.AudioConference.mockClear();
  instance.onAudioConference();
  expect(Actions.AudioConference).not.toBeCalled();
});

it('ChatMessageList calls handleBackPress', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  Actions.pop.mockClear();
  const result = instance.handleBackPress();
  expect(Actions.pop).toBeCalled();
  expect(result).toBe(true);
});

it('ChatMessageList calls isIphoneX - ios', () => {
  Dimensions.get = jest.fn(() => ({ width: 812, height: 812 }));
  jest.doMock('Platform', () => {
    const Platform = require.requireActual('Platform');
    Platform.OS = 'ios';
    return Platform;
  });
  const tree = shallow(<ChatRoom {...props} />);
  expect(tree.state().isIphoneX).toBe(true);
});

it('ChatMessageList calls checkAudioPermission - android', async () => {
  jest.doMock('Platform', () => {
    const platform = {
      OS: 'android',
      Version: 25,
    };
    return platform;
  });
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  expect.assertions(1);
  await instance.checkAudioPermission();
  expect(PermissionsAndroid.requestMultiple).toBeCalled();
});

it('ChatMessageList calls checkAudioPermission - ios', async () => {
  PermissionsAndroid.requestMultiple.mockClear();
  jest.doMock('Platform', () => {
    const Platform = require.requireActual('Platform');
    Platform.OS = 'ios';
    return Platform;
  });
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  expect.assertions(1);
  await instance.checkAudioPermission();
  expect(PermissionsAndroid.requestMultiple).not.toBeCalled();
});

it('ChatMessageList calls checkPhotoLibraryPermission - android, the permission is granted', async () => {
  jest.doMock('Platform', () => {
    const platform = {
      OS: 'android',
      Version: 25,
    };
    return platform;
  });
  PermissionsAndroid.request.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.openPhotoLibrary = jest.fn();
  expect.assertions(2);
  await instance.checkPhotoLibraryPermission();
  expect(PermissionsAndroid.request).toBeCalled();
  expect(instance.openPhotoLibrary).toBeCalled();
});

it('ChatMessageList calls checkPhotoLibraryPermission - android, the permission is not granted', async () => {
  jest.doMock('Platform', () => {
    const platform = {
      OS: 'android',
      Version: 25,
    };
    return platform;
  });
  Alert.alert = jest.fn();
  PermissionsAndroid.request = jest.fn(() => Promise.resolve(false));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.openPhotoLibrary = jest.fn();
  expect.assertions(3);
  await instance.checkPhotoLibraryPermission();
  expect(PermissionsAndroid.request).toBeCalled();
  expect(instance.openPhotoLibrary).not.toBeCalled();
  expect(Alert.alert).toBeCalled();
});

it('ChatMessageList calls checkPhotoLibraryPermission - ios', async () => {
  jest.doMock('Platform', () => {
    const Platform = require.requireActual('Platform');
    Platform.OS = 'ios';
    return Platform;
  });
  PermissionsAndroid.request.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.openPhotoLibrary = jest.fn();
  expect.assertions(2);
  await instance.checkPhotoLibraryPermission();
  expect(PermissionsAndroid.request).not.toBeCalled();
  expect(instance.openPhotoLibrary).toBeCalled();
});

it('ChatMessageList calls checkVideoConfPermission - android, the permissions are granted', async () => {
  jest.doMock('Platform', () => {
    const platform = {
      OS: 'android',
      Version: 25,
    };
    return platform;
  });
  PermissionsAndroid.request = jest.fn(() => Promise.resolve(true));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.onVideoConference = jest.fn();
  expect.assertions(2);
  await instance.checkVideoConfPermission();
  expect(PermissionsAndroid.request).toBeCalledTimes(2);
  expect(instance.onVideoConference).toBeCalled();
});

it('ChatMessageList calls checkVideoConfPermission - android, an audio permission is not granted', async () => {
  jest.doMock('Platform', () => {
    const platform = {
      OS: 'android',
      Version: 25,
    };
    return platform;
  });
  Alert.alert = jest.fn();
  PermissionsAndroid.request = jest
    .fn()
    .mockImplementationOnce(() => Promise.resolve(true))
    .mockImplementationOnce(() => Promise.resolve(false));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.onVideoConference = jest.fn();
  expect.assertions(3);
  await instance.checkVideoConfPermission();
  expect(PermissionsAndroid.request).toBeCalledTimes(2);
  expect(instance.onVideoConference).not.toBeCalled();
  expect(Alert.alert).toBeCalled();
});

it('ChatMessageList calls checkVideoConfPermission - ios', async () => {
  jest.doMock('Platform', () => {
    const Platform = require.requireActual('Platform');
    Platform.OS = 'ios';
    return Platform;
  });
  PermissionsAndroid.request = jest.fn(() => Promise.resolve(true));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.onVideoConference = jest.fn();
  expect.assertions(2);
  await instance.checkVideoConfPermission();
  expect(PermissionsAndroid.request).not.toBeCalled();
  expect(instance.onVideoConference).toBeCalled();
});

it('ChatMessageList calls checkAudioConfPermission - android, the permissions are granted', async () => {
  jest.doMock('Platform', () => {
    const platform = {
      OS: 'android',
      Version: 25,
    };
    return platform;
  });
  PermissionsAndroid.request = jest.fn(() => Promise.resolve(true));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.onAudioConference = jest.fn();
  expect.assertions(2);
  await instance.checkAudioConfPermission();
  expect(PermissionsAndroid.request).toBeCalledTimes(2);
  expect(instance.onAudioConference).toBeCalled();
});

it('ChatMessageList calls checkAudioConfPermission - android, an audio permission is not granted', async () => {
  jest.doMock('Platform', () => {
    const platform = {
      OS: 'android',
      Version: 25,
    };
    return platform;
  });
  Alert.alert = jest.fn();
  PermissionsAndroid.request = jest
    .fn()
    .mockImplementationOnce(() => Promise.resolve(true))
    .mockImplementationOnce(() => Promise.resolve(false));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.onAudioConference = jest.fn();
  expect.assertions(3);
  await instance.checkAudioConfPermission();
  expect(PermissionsAndroid.request).toBeCalledTimes(2);
  expect(instance.onAudioConference).not.toBeCalled();
  expect(Alert.alert).toBeCalled();
});

it('ChatMessageList calls checkAudioConfPermission - ios', async () => {
  jest.doMock('Platform', () => {
    const Platform = require.requireActual('Platform');
    Platform.OS = 'ios';
    return Platform;
  });
  PermissionsAndroid.request = jest.fn(() => Promise.resolve(true));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.onAudioConference = jest.fn();
  expect.assertions(2);
  await instance.checkAudioConfPermission();
  expect(PermissionsAndroid.request).not.toBeCalled();
  expect(instance.onAudioConference).toBeCalled();
});

it('ChatMessageList calls checkCameraPermission - android, the permissions are granted', async () => {
  jest.doMock('Platform', () => {
    const platform = {
      OS: 'android',
      Version: 25,
    };
    return platform;
  });
  PermissionsAndroid.request = jest.fn(() => Promise.resolve(true));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.takePhoto = jest.fn();
  expect.assertions(2);
  await instance.checkCameraPermission();
  expect(PermissionsAndroid.request).toBeCalledTimes(2);
  expect(instance.takePhoto).toBeCalled();
});

it('ChatMessageList calls checkCameraPermission - android, an audio permission is not granted', async () => {
  jest.doMock('Platform', () => {
    const platform = {
      OS: 'android',
      Version: 25,
    };
    return platform;
  });
  Alert.alert = jest.fn();
  PermissionsAndroid.request = jest
    .fn()
    .mockImplementationOnce(() => Promise.resolve(true))
    .mockImplementationOnce(() => Promise.resolve(false));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.takePhoto = jest.fn();
  expect.assertions(3);
  await instance.checkCameraPermission();
  expect(PermissionsAndroid.request).toBeCalledTimes(2);
  expect(instance.takePhoto).not.toBeCalled();
  expect(Alert.alert).toBeCalled();
});

it('ChatMessageList calls checkCameraPermission - ios', async () => {
  jest.doMock('Platform', () => {
    const Platform = require.requireActual('Platform');
    Platform.OS = 'ios';
    return Platform;
  });
  PermissionsAndroid.request = jest.fn(() => Promise.resolve(true));
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.takePhoto = jest.fn();
  expect.assertions(2);
  await instance.checkCameraPermission();
  expect(PermissionsAndroid.request).not.toBeCalled();
  expect(instance.takePhoto).toBeCalled();
});

it('ChatMessageList calls onSend - ios', () => {
  jest.doMock('Platform', () => {
    const Platform = require.requireActual('Platform');
    Platform.OS = 'ios';
    return Platform;
  });
  DbManager._taskManager.chat.sendMessageJob.mockClear();
  DbManager._taskManager.chat.sendTypingNotificationJob.mockClear();
  const message = [{ _id: 'MSS17895oB01', text: 'test' }];
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.gcComp = { textInput: { clear: jest.fn() } };
  instance.onSend(message);
  expect(instance.gcComp.textInput.clear).toBeCalled();
  expect(DbManager._taskManager.chat.sendMessageJob).toBeCalled();
  expect(DbManager._taskManager.chat.sendTypingNotificationJob).toBeCalled();
});

it('ChatMessageList calls onSend - android', () => {
  jest.doMock('Platform', () => {
    const Platform = require.requireActual('Platform');
    Platform.OS = 'android';
    return Platform;
  });
  DbManager._taskManager.chat.sendMessageJob.mockClear();
  DbManager._taskManager.chat.sendTypingNotificationJob.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.gcComp = { textInput: { clear: jest.fn() } };
  instance.composerRef = { clear: jest.fn() };
  instance.onSend();
  expect(instance.gcComp.textInput.clear).toBeCalled();
  expect(tree.state().height).toBe(44);
  expect(tree.state().attachAudioBtn).toBe(true);
  expect(instance.composerRef.clear).toBeCalled();
  expect(instance.textInputValue).toBe('');
  expect(DbManager._taskManager.chat.sendMessageJob).toBeCalled();
  expect(DbManager._taskManager.chat.sendTypingNotificationJob).toBeCalled();
});

it('ChatMessageList calls onInputTextChanged - an empty input', () => {
  DbManager._taskManager.chat.sendTypingNotificationJob.mockClear();
  const text = '';
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.onInputTextChanged(text);
  expect(DbManager._taskManager.chat.sendTypingNotificationJob).not.toBeCalled();
});

it('ChatMessageList calls onInputTextChanged - a non empty input', () => {
  DbManager._taskManager.chat.sendTypingNotificationJob.mockClear();
  const text = 'hello';
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ user: DbManager.user.loggedInUser });
  const instance = tree.instance();
  instance.onInputTextChanged(text);
  expect(DbManager._taskManager.chat.sendTypingNotificationJob).toBeCalledWith(
    groupId,
    DbManager.user.loggedInUser,
    true,
  );
});

it('ChatMessageList calls onLoadEarlier without group id', () => {
  DbManager._taskManager.chat.loadEarlierMessage.mockClear();
  const id = undefined;
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.onLoadEarlier(id);
  expect(DbManager._taskManager.chat.loadEarlierMessage).not.toBeCalled();
});

it('ChatMessageList calls onLoadEarlier wit group id', () => {
  DbManager._taskManager.chat.loadEarlierMessage.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.onLoadEarlier(groupId);
  expect(DbManager._taskManager.chat.loadEarlierMessage).toBeCalled();
});

it('ChatMessageList calls onChangeTextInput', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  const text = 'who is';
  instance.onChangeTextInput(text);
  // expect(tree.state().attachAudioBtn).toBe(!text.length);
  expect(instance.textInputValue).toMatch(text);
});

it('ChatMessageList calls showMessageInfo', () => {
  const currentMessage = {
    _id: 'MSG555555677',
    text: 'have you got my present?',
    user: { _id: 'CM1258g51dF00', name: 'youKnowWhoAmI', username: 'whoAmI', avatar: 'WHOMI' },
  };
  Actions.MessageInfo.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.showMessageInfo(currentMessage);
  expect(Actions.MessageInfo).toBeCalled();
});

it('ChatMessageList calls likeMessage', () => {
  const id = 'MSG555555677';
  DbManager._taskManager.chat.setLikeOnMessage.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.likeMessage(id);
  expect(DbManager._taskManager.chat.setLikeOnMessage).toBeCalled();
});

it('ChatMessageList calls setGroupMessagesAsRead with 0 unread messages & a false sendStatus', () => {
  DbManager._taskManager.chat.sendReadStatusJob.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  const isUnread = 0;
  const sendStatus = false;
  instance.setGroupMessagesAsRead(isUnread, sendStatus);
  expect(DbManager._taskManager.chat.sendReadStatusJob).not.toBeCalled();
});

it('ChatMessageList calls setGroupMessagesAsRead with unread messages & a false sendStatus', () => {
  DbManager._taskManager.chat.sendReadStatusJob.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  const isUnread = 8;
  const sendStatus = false;
  instance.setGroupMessagesAsRead(isUnread, sendStatus);
  expect(DbManager._taskManager.chat.sendReadStatusJob).toBeCalled();
});

it('ChatMessageList calls setGroupMessagesAsRead with unread messages & a true sendStatus', () => {
  DbManager._taskManager.chat.sendReadStatusJob.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  const isUnread = 8;
  const sendStatus = true;
  instance.setGroupMessagesAsRead(isUnread, sendStatus);
  expect(DbManager._taskManager.chat.sendReadStatusJob).toBeCalled();
});

it('ChatMessageList calls setGroupMessagesAsRead with 0 unread messages & a true sendStatus', () => {
  DbManager._taskManager.chat.sendReadStatusJob.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  const isUnread = 0;
  const sendStatus = true;
  instance.setGroupMessagesAsRead(isUnread, sendStatus);
  expect(DbManager._taskManager.chat.sendReadStatusJob).toBeCalled();
});

it('ChatMessageList shouldSendReadStatus returns false', () => {
  const messages = [
    {
      _id: 'MSG22222203',
      text: 'yes we can',
      user: DbManager.user.likeMessage,
      replyMessageId: 'MSG22222202',
      group: groupInfo,
      type: 10,
      isReply: true,
    },
    {
      _id: 'MSG22222209',
      text: 'but not today',
      user: { _id: 'PP1258g51dF92', name: 'busy-dev' },
      replyMessageId: 'MSG22222202',
      group: groupInfo,
      type: 10,
      isReply: true,
    },
  ];
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ messages });
  const instance = tree.instance();
  const sendStatus = instance.shouldSendReadStatus(messages);
  expect(sendStatus).toBe(false);
});

it('ChatMessageList shouldSendReadStatus returns true', () => {
  const messages = [
    {
      _id: 'MSG22222203',
      text: 'yes we can',
      user: DbManager.user.loggedInUser,
      replyMessageId: 'MSG22222202',
      group: groupInfo,
      type: 10,
      isReply: true,
    },
    {
      _id: 'MSG22222209',
      text: 'but not today',
      user: { _id: 'PP1258g51dF92', name: 'busy-dev' },
      replyMessageId: 'MSG22222202',
      group: groupInfo,
      type: 10,
      isReply: true,
    },
  ];
  const newMessage = {
    _id: 'MSG22222221',
    text: 'mmmm, that is what we do',
    user: { _id: 'PP1258g51dF92', name: 'busy-dev' },
    replyMessageId: 'MSG22222202',
    group: groupInfo,
    type: 10,
    isReply: true,
  };
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ messages });
  const instance = tree.instance();
  const sendStatus = instance.shouldSendReadStatus([newMessage, ...messages]);
  expect(sendStatus).toBe(true);
});

it('ChatMessageList shouldSendReadStatus returns false - no messages', () => {
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ messages: null });
  const instance = tree.instance();
  const sendStatus = instance.shouldSendReadStatus(null);
  expect(sendStatus).toBe(false);
});

it('ChatMessageList calls fetchGroupMessages - the component is not mounted', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance._isMounted = false;
  instance.setGroupMessagesAsRead = jest.fn();
  instance.fetchGroupMessages();
  expect(instance.setGroupMessagesAsRead).not.toBeCalled();
});

it('ChatMessageList calls fetchGroupMessages - insideStateUpdate', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance._isMounted = true;
  instance._insideStateUpdate = true;
  instance.setGroupMessagesAsRead = jest.fn();
  instance.fetchGroupMessages();
  expect(instance.setGroupMessagesAsRead).not.toBeCalled();
});

it('ChatMessageList calls fetchGroupMessages - no group id', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance._insideStateUpdate = false;
  instance.groupId = null;
  instance.setGroupMessagesAsRead = jest.fn();
  instance.fetchGroupMessages();
  expect(instance.setGroupMessagesAsRead).not.toBeCalled();
});

it('ChatMessageList calls fetchGroupMessages', async () => {
  const messages = [
    {
      _id: 'MSG22222203',
      text: 'yes we can',
      user: DbManager.user.loggedInUser,
      replyMessageId: 'MSG22222202',
      group: groupInfo,
      type: 10,
      isReply: true,
    },
    {
      _id: 'MSG22222209',
      text: 'but not today',
      user: { _id: 'PP1258g51dF92', name: 'busy-dev' },
      replyMessageId: 'MSG22222202',
      group: groupInfo,
      type: 10,
      isReply: true,
    },
  ];
  groupInfo.moreMessages = true;
  DbManager.group.getGroupMessages = jest.fn(() => messages);
  DbManager.group.findById = jest.fn(() => groupInfo);
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.setGroupMessagesAsRead = jest.fn();
  instance.shouldSendReadStatus = jest.fn(() => true);
  instance.isOwner = true;
  expect.assertions(4);
  await instance.fetchGroupMessages();
  expect(tree.state().readOnly).toEqual(false);
  expect(tree.state().loadEarlier).toEqual(true);
  expect(instance.shouldSendReadStatus).toBeCalled();
  expect(instance.setGroupMessagesAsRead).toBeCalled();
});

it('ChatMessageList calls fetchGroupMessages - readOnly group', async () => {
  const messages = [
    {
      _id: 'MSG22222203',
      text: 'yes we can',
      user: DbManager.user.loggedInUser,
      replyMessageId: 'MSG22222202',
      group: groupInfo,
      type: 10,
      isReply: true,
    },
    {
      _id: 'MSG22222209',
      text: 'but not today',
      user: { _id: 'PP1258g51dF92', name: 'busy-dev' },
      replyMessageId: 'MSG22222202',
      group: groupInfo,
      type: 10,
      isReply: true,
    },
  ];
  groupInfo.moreMessages = false;
  groupInfo.readonly = true;
  groupInfo.userMuted = true;
  DbManager.group.getGroupMessages = jest.fn(() => messages);
  DbManager.group.findById = jest.fn(() => groupInfo);
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.setGroupMessagesAsRead = jest.fn();
  instance.shouldSendReadStatus = jest.fn(() => true);
  instance.isOwner = false;
  expect.assertions(4);
  await instance.fetchGroupMessages();
  expect(tree.state().readOnly).toEqual(true);
  expect(tree.state().loadEarlier).toEqual(false);
  expect(instance.shouldSendReadStatus).toBeCalled();
  expect(instance.setGroupMessagesAsRead).toBeCalled();
});

it('ChatMessageList calls startVideoConference', () => {
  DbManager._taskManager.chat.startVideoConference = jest.fn();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.startVideoConference();
  expect(DbManager._taskManager.chat.startVideoConference).toBeCalled();
});

it('ChatMessageList calls deleteMessage of another user', () => {
  DbManager._taskManager.chat.deleteMessageJob.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ user: DbManager.user.loggedInUser });
  const instance = tree.instance();
  const messageId = 'MSZ7777705';
  const userId = 'ZZZ12398Ht';
  instance.deleteMessage(messageId, userId);
  expect(DbManager._taskManager.chat.deleteMessageJob).not.toBeCalled();
});

it('ChatMessageList calls deleteMessage of a current user', () => {
  DbManager._taskManager.chat.deleteMessageJob.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ user: DbManager.user.loggedInUser });
  const instance = tree.instance();
  const messageId = 'MSZ7777705';
  const userId = DbManager.user.loggedInUser._id;
  instance.deleteMessage(messageId, userId);
  expect(DbManager._taskManager.chat.deleteMessageJob).toBeCalled();
});

it('ChatMessageList calls goToRoomInfo for non direct groups', () => {
  Keyboard.dismiss.mockClear();
  Actions.GroupInfo.mockClear();
  groupInfo.type = 'p';
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ groupInfo });
  const instance = tree.instance();
  instance.goToRoomInfo();
  expect(Keyboard.dismiss).toBeCalled();
  expect(Actions.GroupInfo).toBeCalledWith({ memberId: instance.groupId });
});

it('ChatMessageList calls goToRoomInfo for direct groups', () => {
  Keyboard.dismiss.mockClear();
  Actions.MemberInfo.mockClear();
  groupInfo.type = 'd';
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ groupInfo });
  const instance = tree.instance();
  instance.goToRoomInfo();
  expect(Keyboard.dismiss).toBeCalled();
  expect(Actions.MemberInfo).toBeCalledWith({ memberId: instance.groupId });
});

it('ChatMessageList calls goToBoardTask for direct groups', () => {
  Keyboard.dismiss.mockClear();
  Actions.GroupTasksList.mockClear();
  groupInfo.type = 'd';
  groupInfo.title = 'UT process';
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ groupInfo });
  const instance = tree.instance();
  instance.goToBoardTask();
  expect(Keyboard.dismiss).not.toBeCalled();
  expect(Actions.GroupTasksList).not.toBeCalled();
});

it('ChatMessageList calls goToBoardTask for a non direct group, from the current scene', () => {
  Keyboard.dismiss.mockClear();
  Actions.GroupTasksList.mockClear();
  Actions.currentScene = 'ChatRoomScene';
  groupInfo.type = 'p';
  groupInfo.title = 'UT process';
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ groupInfo });
  const instance = tree.instance();
  const task = shallow(<View>{instance.goToBoardTask()}</View>);
  task
    .find('TouchableOpacity')
    .props()
    .onPress();
  expect(Keyboard.dismiss).toBeCalled();
  expect(Actions.GroupTasksList).toBeCalledWith({ boardName: groupInfo.title, groupId });
});

it('ChatMessageList calls goToBoardTask for a non direct group, from the other scene', () => {
  Keyboard.dismiss.mockClear();
  Actions.GroupTasksList.mockClear();
  Actions.currentScene = 'NewsScene';
  groupInfo.type = 'p';
  groupInfo.title = 'UT process';
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ groupInfo });
  const instance = tree.instance();
  const task = shallow(<View>{instance.goToBoardTask()}</View>);
  task
    .find('TouchableOpacity')
    .props()
    .onPress();
  expect(Keyboard.dismiss).toBeCalled();
  expect(Actions.GroupTasksList).not.toBeCalled();
});

it('ChatMessageList calls goToReplyMessage - a message has no id', () => {
  Actions.ReplyMessage.mockClear();
  const messages = [
    {
      _id: null,
      text: 'yes we can',
      user: DbManager.user.loggedInUser,
      replyMessageId: null,
      type: 10,
      isReply: false,
    },
  ];
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ groupInfo, messages, user: messages[0].user, canDelete: false });
  const instance = tree.instance();
  instance.goToReplyMessage(messages[0]);
  expect(Actions.ReplyMessage).not.toBeCalled();
});

it('ChatMessageList calls goToReplyMessage - a message has an id', () => {
  Actions.ReplyMessage.mockClear();
  const messages = [
    {
      _id: 'MSG22222203',
      text: 'yes we can',
      user: DbManager.user.loggedInUser,
      replyMessageId: 'AAA111111',
      type: 10,
      isReply: true,
    },
  ];
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ groupInfo, messages, user: messages[0].user, canDelete: false });
  const instance = tree.instance();
  instance.goToReplyMessage(messages[0]);
  expect(Actions.ReplyMessage).toBeCalledWith({
    group: groupInfo,
    user: DbManager.user.loggedInUser,
    messages,
    replyMessage: messages[0],
    canDelete: false,
  });
});

it('ChatMessageList calls cameraSuccess with group info', () => {
  Actions.popTo.mockClear();
  Actions.refresh.mockClear();
  const imageCaption = 'My tasty sandwich';
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.CameraSuccess(roomInfo, dataToUpload, imageCaption);
  expect(Actions.popTo).toBeCalled();
  expect(setTimeout).toBeCalled();
  jest.runAllTimers();
  expect(Actions.refresh).toBeCalled();
});

it('ChatMessageList calls cameraSuccess with group info', () => {
  Actions.popTo.mockClear();
  Actions.Chat.mockClear();
  const imageCaption = 'My tasty sandwich';
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.CameraSuccess(null, dataToUpload, imageCaption);
  expect(Actions.popTo).not.toBeCalled();
  expect(setTimeout).not.toBeCalled();
  expect(Actions.Chat).toBeCalled();
});

it('ChatMessageList calls uploadMedia for an image', () => {
  DbManager._taskManager.chat.uploadMediaJob.mockClear();
  const imageCaption = 'My tasty sandwich';
  const newDataToUpload = {
    uri: '//Camera/album1/image01-02-03.jpg',
    size: '800x600',
  };
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.uploadMedia(groupId, newDataToUpload, imageCaption);
  expect(DbManager._taskManager.chat.uploadMediaJob).toBeCalledWith(
    newDataToUpload,
    groupId,
    true,
    imageCaption,
  );
});

it('ChatMessageList calls uploadMedia for an audio file', () => {
  DbManager._taskManager.chat.uploadMediaJob.mockClear();
  const imageCaption = 'My tasty sandwich';
  const newDataToUpload = {
    uri: '//VoiceRecords/greetings03.mp4',
  };
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.uploadMedia(groupId, newDataToUpload, imageCaption);
  expect(DbManager._taskManager.chat.uploadMediaJob).toBeCalledWith(
    newDataToUpload,
    groupId,
    false,
    imageCaption,
  );
});

it('ChatMessageList calls toggleActionsMenu', () => {
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ actionsMenu: true });
  const instance = tree.instance();
  instance.toggleActionsMenu();
  expect(tree.state().actionsMenu).toBe(false);
});

it('ChatMessageList calls takePhoto', () => {
  Actions.CameraScreen.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.takePhoto();
  expect(Actions.CameraScreen).toBeCalled();
});

it('ChatMessageList calls openPhotoLibrary', () => {
  Actions.PhotoLibrary.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.openPhotoLibrary();
  expect(Actions.PhotoLibrary).toBeCalled();
});

describe('ChatMessageList calls renderTick', () => {
  const currentMessage = {
    _id: 'X01020130P',
    text: 'Just be sure before you will give it all to me',
    user: { _id: 'U007', username: 'someone' },
    status: 100,
    isReply: false,
  };

  it('a message user is not the current user ', () => {
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const ticks = instance.renderTick(currentMessage);
    expect(ticks).toBeNull();
  });

  it('shows a double tick', () => {
    currentMessage.user = DbManager.user.loggedInUser;
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ user: DbManager.user.loggedInUser });
    const instance = tree.instance();
    const ticks = shallow(instance.renderTick(currentMessage)).find('Text');
    expect(ticks.length).toBe(2);
  });

  it('shows a single tick', () => {
    currentMessage.user = DbManager.user.loggedInUser;
    currentMessage.status = 10;
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ user: DbManager.user.loggedInUser });
    const instance = tree.instance();
    const ticks = shallow(instance.renderTick(currentMessage)).find('Text');
    expect(ticks.length).toBe(1);
  });

  it('shows no ticks', () => {
    currentMessage.user = DbManager.user.loggedInUser;
    currentMessage.status = 0;
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ user: DbManager.user.loggedInUser });
    const instance = tree.instance();
    const ticks = instance.renderTick(currentMessage);
    expect(ticks).toBeNull();
  });
});

describe('ChatMessageList calls renderTime', () => {
  const currentMessage = {
    _id: 'X01020130P',
    text: 'Just be sure before you will give it all to me',
    user: { _id: 'U007', username: 'someone' },
    status: 100,
    isReply: false,
    createdAt: 1550480397493,
  };

  it('in a left position', () => {
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const time = shallow(instance.renderTime({ currentMessage, position: 'left' }));
    expect(time.find('Text').props().style[1]).toEqual({ color: Colors.TEXT_LEFT_TIME });
  });

  it('in a right position', () => {
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const time = shallow(instance.renderTime({ currentMessage, position: 'right' }));
    expect(time.find('Text').props().style[1]).toEqual({ color: Colors.TEXT_RIGHT_TIME });
  });
});

describe('ChatMessageList calls renderBubble', () => {
  const bubbleProps = {
    currentMessage: {
      _id: 'X01020130P',
      text: 'Just be sure before you will give it all to me',
      user: { _id: 'U007', username: 'someone' },
      status: 100,
      isReply: false,
    },
    previousMessage: {
      _id: 'Y02Yt78c8',
      text: 'I am ready. Now?',
      user: { _id: 'U003', username: 'mainUser' },
      status: 100,
      isReply: false,
    },
    isSameUser: jest.fn(() => true),
    isSameDay: jest.fn(() => false),
    position: 'left',
    user: { _id: 'U007', username: 'someone' },
  };

  it('Bubble is rendered', () => {
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const bubble = shallow(instance.renderBubble(bubbleProps));
    expect(bubble.find('Bubble').length).toBe(1);
    expect(bubble.find('Text').length).toBe(1);
  });

  it('Bubble is rendered with displayName', () => {
    bubbleProps.isSameUser = jest.fn(() => true);
    bubbleProps.isSameDay = jest.fn(() => true);
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const bubble = shallow(instance.renderBubble(bubbleProps));
    expect(bubble.find('Text').length).toBe(0);
  });

  it('Bubble is rendered with an image loading', () => {
    bubbleProps.position = 'right';
    bubbleProps.currentMessage.image = '//images/test-image.jpg';
    bubbleProps.currentMessage.status = 0;
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const bubble = shallow(instance.renderBubble(bubbleProps));
    expect(bubble.find('Text').length).toBe(0);
  });

  it('Bubble is rendered with a deleted message', () => {
    bubbleProps.currentMessage.status = -1;
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const bubble = instance.renderBubble(bubbleProps);
    expect(bubble).toBeNull();
  });

  it('Bubble props are called', () => {
    bubbleProps.currentMessage.status = 10;
    bubbleProps.currentMessage.isReply = true;
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    instance.renderTick = jest.fn();
    instance.renderTime = jest.fn();
    instance.renderFileAttachment = jest.fn();
    const bubble = shallow(instance.renderBubble(bubbleProps)).find('Bubble');
    bubble.props().renderTicks();
    bubble.props().renderCustomView();
    bubble.props().renderTime();
    expect(instance.renderTick).toBeCalled();
    expect(instance.renderFileAttachment).toBeCalled();
    expect(instance.renderTime).toBeCalled();
  });
});

describe('ChatMessageList calls renderMessageImage', () => {
  const currentMessage = {
    _id: 'X01020130P',
    text: 'Just be sure before you will give it all to me',
    user: { _id: 'U007', username: 'someone' },
    status: 100,
    isReply: false,
    image: '//images/my-image22.png',
    uploadFilePercent: null,
  };

  it('from the ChatRoomScene', () => {
    Actions.ViewImage = jest.fn((obj) => {
      obj.goBack();
      obj.deleteMessage();
    });
    Actions.currentScene = 'ChatRoomScene';
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    instance.deleteMessage = jest.fn();
    const wrapper = shallow(<View>{instance.renderMessageImage({ currentMessage })}</View>);
    const touchOpacity = wrapper.find('TouchableOpacity');
    touchOpacity.props().onPress();
    expect(tree.state().actionsMenu).toBe(false);
    expect(Actions.ViewImage).toBeCalled();
    const image = wrapper.find('FastImage');
    expect(image.length).toBe(1);
  });

  it('from the other scene', () => {
    Actions.ViewImage.mockClear();
    Actions.currentScene = 'NewsScene';
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    instance.deleteMessage = jest.fn();
    const wrapper = shallow(<View>{instance.renderMessageImage({ currentMessage })}</View>);
    const touchOpacity = wrapper.find('TouchableOpacity');
    touchOpacity.props().onPress();
    expect(Actions.ViewImage).not.toBeCalled();
  });

  it('an image upload', () => {
    currentMessage.uploadFilePercent = 0.48;
    currentMessage.status = 0;
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const wrapper = shallow(<View>{instance.renderMessageImage({ currentMessage })}</View>);
    const uploadProgress = wrapper.find('UploadProgress');
    expect(uploadProgress.props().uploadFilePercent).toBe(0.48);
  });
});

describe('ChatMessageList calls renderMessageText', () => {
  const currentMessage = {
    _id: 'X01020130P',
    text: 'Video Call',
    user: { _id: 'U007', username: 'someone' },
    status: 0,
    type: 4,
    isReply: false,
  };

  it('a video message', async () => {
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    instance.checkVideoConfPermission = jest.fn(() => Promise.resolve(true));
    const wrapper = shallow(<View>{instance.renderMessageText({ currentMessage })}</View>);
    const touchOpacity = wrapper.find('TouchableOpacity');
    await touchOpacity.props().onPress();
    expect(tree.state().actionsMenu).toBe(false);
    expect(instance.checkVideoConfPermission).toBeCalled();
  });

  it('not a video message', () => {
    currentMessage.type = 1;
    currentMessage.text = 'It is a pendulum';
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ user: currentMessage.user });
    const instance = tree.instance();
    const wrapper = shallow(<View>{instance.renderMessageText({ currentMessage })}</View>);
    const customMessage = wrapper.find('CustomMessage');
    expect(customMessage).toBeTruthy();
  });
});

it('ChatMessageList calls renderAvatar', () => {
  Actions.MemberInfo.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  const avatarProps = {
    currentMessage: {
      _id: 'MSG555555677',
      text: 'have you got my present?',
      user: {
        _id: 'U007',
        username: 'someone',
        name: 'Mr.Someone',
        avatar: 'http://www.cool-avatar.com.eg/007.jpg',
      },
    },
  };
  const view = shallow(instance.renderAvatar(avatarProps));
  const avatar = view.find('Avatar');
  avatar.props().onAvatarPress();
  expect(avatar.props().avatarName).toMatch(avatarProps.currentMessage.user.name);
  expect(Actions.MemberInfo).toBeCalled();
});

describe('ChatMessageList calls renderChatFooter', () => {
  it('showActions is false', () => {
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ actionsMenu: false });
    const instance = tree.instance();
    const wrapper = instance.renderChatFooter();
    expect(wrapper).toBeUndefined();
  });

  it('actionsMenu is true - onPress checkPhotoLibraryPermission from current scene', async () => {
    Actions.currentScene = 'ChatRoomScene';
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ actionsMenu: true });
    const instance = tree.instance();
    instance.checkPhotoLibraryPermission = jest.fn();
    const wrapper = shallow(instance.renderChatFooter());
    const touchOpacity = wrapper.find('TouchableOpacity').first();
    expect.assertions(1);
    await touchOpacity.props().onPress();
    expect(instance.checkPhotoLibraryPermission).toBeCalled();
  });

  it('actionsMenu is true - onPress checkPhotoLibraryPermission from the other scene', async () => {
    Actions.currentScene = 'NewsScene';
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ actionsMenu: true });
    const instance = tree.instance();
    instance.checkPhotoLibraryPermission = jest.fn();
    const wrapper = shallow(instance.renderChatFooter());
    const touchOpacity = wrapper.find('TouchableOpacity').first();
    expect.assertions(1);
    await touchOpacity.props().onPress();
    expect(instance.checkPhotoLibraryPermission).not.toBeCalled();
  });

  it('actionsMenu is true - onPress checkCameraPermission from current scene', async () => {
    Actions.currentScene = 'ChatRoomScene';
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ actionsMenu: true });
    const instance = tree.instance();
    instance.checkCameraPermission = jest.fn();
    const wrapper = shallow(instance.renderChatFooter());
    const touchOpacity = wrapper.find('TouchableOpacity').at(1);
    expect.assertions(1);
    await touchOpacity.props().onPress();
    expect(instance.checkCameraPermission).toBeCalled();
  });

  it('actionsMenu is true - onPress checkCameraPermission from the other scene', async () => {
    Actions.currentScene = 'NewsScene';
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ actionsMenu: true });
    const instance = tree.instance();
    instance.checkCameraPermission = jest.fn();
    const wrapper = shallow(instance.renderChatFooter());
    const touchOpacity = wrapper.find('TouchableOpacity').at(1);
    expect.assertions(1);
    await touchOpacity.props().onPress();
    expect(instance.checkCameraPermission).not.toBeCalled();
  });

  it('actionsMenu is true - onPress pickVideosFromGallery from current scene', async () => {
    Actions.currentScene = 'ChatRoomScene';
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ actionsMenu: true });
    const instance = tree.instance();
    instance.pickVideosFromGallery = jest.fn();
    const wrapper = shallow(instance.renderChatFooter());
    const touchOpacity = wrapper.find('TouchableOpacity').last();
    expect.assertions(1);
    await touchOpacity.props().onPress();
    expect(instance.pickVideosFromGallery).toBeCalled();
  });

  it('actionsMenu is true - onPress pickVideosFromGallery from the other scene', async () => {
    Actions.currentScene = 'NewsScene';
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ actionsMenu: true });
    const instance = tree.instance();
    instance.pickVideosFromGallery = jest.fn();
    const wrapper = shallow(instance.renderChatFooter());
    const touchOpacity = wrapper.find('TouchableOpacity').last();
    expect.assertions(1);
    await touchOpacity.props().onPress();
    expect(instance.pickVideosFromGallery).not.toBeCalled();
  });
});

it('ChatMessageList calls renderActions', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.toggleActionsMenu = jest.fn();
  const wrapper = shallow(<View>{instance.renderActions()}</View>);
  const touchOpacity = wrapper.find('TouchableOpacity');
  touchOpacity.props().onPress();
  expect(instance.toggleActionsMenu).toBeCalled();
});

describe('ChatMessageList calls renderSend', () => {
  const sendProps = {
    text: 'Use your imagination',
  };

  beforeEach(() => {
    jest.resetModules();
  });

  it('ios platform', () => {
    jest.doMock('Platform', () => {
      const Platform = require.requireActual('Platform');
      Platform.OS = 'ios';
      return Platform;
    });
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const sendIcon = shallow(instance.renderSend(sendProps)).find('Icon');
    expect(sendIcon.length).toBe(1);
  });

  // it('android platform - attachAudioBtn is false', () => {
  //   jest.doMock('Platform', () => {
  //     const Platform = require.requireActual('Platform');
  //     Platform.OS = 'android';
  //     return Platform;
  //   });
  //   const tree = shallow(<ChatRoom {...props} />);
  //   tree.setState({attachAudioBtn: null});
  //   console.log(tree.state().attachAudioBtn);
  //   const instance = tree.instance();
  //   instance.textInputValue = sendProps.text;
  //   const sendIcon = shallow(instance.renderSend(sendProps)).find({name:"send"});
  //   expect(sendIcon.length).toBe(1);
  // });

  it('android platform - attachAudioBtn is true', async () => {
    jest.doMock('Platform', () => {
      const Platform = require.requireActual('Platform');
      Platform.OS = 'android';
      return Platform;
    });
    Keyboard.dismiss.mockClear();
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ attachAudioBtn: true });
    const instance = tree.instance();
    instance.checkAudioPermission = jest.fn();
    instance.textInputValue = sendProps.text;
    const button = shallow(<View>{instance.renderSend(sendProps)}</View>).find('TouchableOpacity');
    expect.assertions(4);
    await button.props().onPress();
    expect(Keyboard.dismiss).toBeCalled();
    expect(instance.checkAudioPermission).toBeCalled();
    expect(tree.state().actionsMenu).toBe(false);
    expect(tree.state().attachAudio).toBe(true);
  });

  it('android platform - attachAudioBtn is true & no audio config', () => {
    jest.doMock('Platform', () => {
      const Platform = require.requireActual('Platform');
      Platform.OS = 'android';
      return Platform;
    });
    Application.APPCONFIG.ATTACH_AUDIO = false;
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ attachAudioBtn: true });
    const instance = tree.instance();
    instance.textInputValue = sendProps.text;
    const button = instance.renderSend(sendProps);
    expect(button).toBeUndefined();
  });
});

it('ChatMessageList calls renderAudioRecorder', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  const audio = shallow(<View>{instance.renderAudioRecorder()}</View>).find('AttachAudio');
  expect(audio).toBeTruthy();
});

describe('ChatMessageList calls renderFileAttachment', () => {
  const currentMessage = {
    _id: 'X01020130P',
    text: 'Just be sure before you will give it all to me',
    user: { _id: 'U007', username: 'someone' },
    status: 100,
    isReply: false,
    remoteFile: null,
    uploadFilePercent: null,
  };

  it('without a remote file ', () => {
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const attachment = instance.renderFileAttachment({ currentMessage });
    expect(attachment).toBeNull();
  });

  it('with a remote audio file ', () => {
    currentMessage.remoteFile = '//files/remote-file1.mp4';
    currentMessage.remoteFileType = 'audio';
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    instance.deleteMessage = jest.fn();
    const attachment = shallow(
      instance.renderFileAttachment({
        currentMessage,
        position: 'left',
      }),
    ).find('AudioPlay');
    attachment.props().deleteMessage();
    expect(attachment.length).toBe(1);
    expect(instance.deleteMessage).toBeCalled();
  });

  it('with an uploading remote audio file ', () => {
    currentMessage.remoteFile = '//files/remote-file1.mp4';
    currentMessage.remoteFileType = 'audio';
    currentMessage.type = 3;
    currentMessage.status = 0;
    currentMessage.uploadFilePercent = 0.74;
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const progress = shallow(
      instance.renderFileAttachment({
        currentMessage,
        position: 'left',
      }),
    ).find('UploadProgress');
    expect(progress.length).toBe(1);
    expect(progress.props().uploadFilePercent).toBe(0.74);
  });

  it('with a remote video file ', () => {
    Actions.currentScene = 'ChatRoomScene';
    Actions.VideoPreview = jest.fn((obj) => {
      obj.deleteMessage();
    });
    Keyboard.dismiss.mockClear();
    currentMessage.remoteFile = '//files/remote-file2.mp4';
    currentMessage.remoteFileType = 'video';
    currentMessage.type = null;
    currentMessage.status = 10;
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    instance.deleteMessage = jest.fn();
    const attachment = shallow(
      <View>{instance.renderFileAttachment({ currentMessage, position: 'right' })}</View>,
    ).find('TouchableOpacity');
    attachment.props().onPress();
    expect(tree.state().actionsMenu).toBe(false);
    expect(instance.deleteMessage).toBeCalled();
    Actions.currentScene = 'NewsScene';
    attachment.props().onPress();
    expect(Keyboard.dismiss).toBeCalledTimes(1);
    expect(Actions.VideoPreview).toBeCalledTimes(1);
  });

  it('with an uploading remote video file ', () => {
    currentMessage.remoteFile = '//files/remote-file2.mp4';
    currentMessage.remoteFileType = 'video';
    currentMessage.type = 2;
    currentMessage.status = 0;
    currentMessage.uploadFilePercent = 0.32;
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const progress = shallow(
      instance.renderFileAttachment({
        currentMessage,
        position: 'right',
      }),
    ).find('UploadProgress');
    expect(progress.length).toBe(1);
    expect(progress.props().uploadFilePercent).toBe(0.32);
  });
});

describe('ChatMessageList calls renderComposer', () => {
  const composerProps = {
    text: 'Supersonic is here',
  };

  beforeEach(() => {
    jest.resetModules();
  });

  it('ios platform', () => {
    jest.doMock('Platform', () => {
      const Platform = require.requireActual('Platform');
      Platform.OS = 'ios';
      return Platform;
    });
    const tree = shallow(<ChatRoom {...props} />);
    const instance = tree.instance();
    const composer = shallow(instance.renderComposer(composerProps));
    expect(composer).toBeTruthy();
  });

  it('android platform', () => {
    jest.doMock('Platform', () => {
      const Platform = require.requireActual('Platform');
      Platform.OS = 'android';
      return Platform;
    });
    const tree = shallow(<ChatRoom {...props} />);
    tree.setState({ height: 44 });
    const instance = tree.instance();
    instance.onChangeTextInput = jest.fn();
    const nativeEvent = {
      nativeEvent: {
        contentSize: {
          height: 120,
        },
      },
    };
    const textInput = shallow(instance.renderComposer(composerProps)).find('TextInput');
    textInput.props().onContentSizeChange(nativeEvent);
    textInput.props().onChangeText('Friday');
    textInput.props().onChange();
    textInput.props().onFocus();
    textInput.getElement().ref({});
    expect(tree.state().height).toBe(120);
    expect(instance.onChangeTextInput).toBeCalled();
    expect(instance.composerRef).toBeTruthy();
    expect(tree.state().attachAudioBtn).toBe(false);
    expect(tree.state().actionsMenu).toBe(false);
  });
});

it('ChatMessageList calls openImagePreview', () => {
  Actions.ImagePreview = jest.fn((obj) => {
    obj.onSuccessAction();
  });
  Actions.pop.mockClear();
  Actions.refresh.mockClear();
  const data = {
    uri: '//Camera/album1/image01-02-03.jpg',
    size: '800x600',
  };
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.openImagePreview(data);
  expect(Actions.ImagePreview).toBeCalled();
  expect(Actions.pop).toBeCalled();
  expect(setTimeout).toBeCalled();
  jest.runAllTimers();
  expect(Actions.refresh).toBeCalled();
});

it('ChatMessageList calls pickVideosFromGallery', async () => {
  Actions.refresh.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.toggleActionsMenu = jest.fn();
  await instance.pickVideosFromGallery();
  expect(Actions.refresh).toBeCalled();
});

it('ChatMessageList calls renderReadOnly', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  const view = shallow(instance.renderReadOnly()).find('Text');
  expect(view.props().children).toMatch('Read only channel');
});

it('ChatMessageList calls renderVoiceInput', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  const voice = shallow(<View>{instance.renderVoiceInput()}</View>).find('VoiceComp');
  expect(voice).toBeTruthy();
});

it('onPress of a navbar back button from ChatRoomScene', () => {
  Actions.currentScene = 'ChatRoomScene';
  Actions.pop.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const backButton = tree
    .find('NavBar')
    .shallow()
    .find({ name: 'chevron-left' })
    .parent();
  backButton.props().onPress();
  expect(Actions.pop).toBeCalled();
});

it('onPress of a navbar back button from other scene', () => {
  Actions.currentScene = 'NewsScene';
  Actions.pop.mockClear();
  const tree = shallow(<ChatRoom {...props} />);
  const backButton = tree
    .find('NavBar')
    .shallow()
    .find({ name: 'chevron-left' })
    .parent();
  backButton.props().onPress();
  expect(Actions.pop).not.toBeCalled();
});

it('onPress of a navbar videoConf button, no audio conf', async () => {
  Application.APPCONFIG.ATTACH_VIDEOCONF = true;
  Application.APPCONFIG.HIDE_GROUP_TASKS = true;
  Application.APPCONFIG.HIDE_AUDIO_CONF = true;
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.checkVideoConfPermission = jest.fn();
  instance.checkAudioConfPermission = jest.fn();
  instance.goToBoardTask = jest.fn();
  const videoConf = tree
    .find('NavBar')
    .shallow()
    .find({ name: 'video' })
    .parent();
  expect.assertions(4);
  await videoConf.props().onPress();
  expect(instance.goToBoardTask).not.toBeCalled();
  expect(instance.checkAudioConfPermission).not.toBeCalled();
  expect(instance.checkVideoConfPermission).toBeCalled();
  expect(tree.state().actionsMenu).toBe(false);
});

it('onPress of a navbar videoConf button', async () => {
  Application.APPCONFIG.ATTACH_VIDEOCONF = true;
  Application.APPCONFIG.SHOW_GROUP_TASKS = true;
  Application.APPCONFIG.HIDE_AUDIO_CONF = false;
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.checkAudioConfPermission = jest.fn();
  instance.goToBoardTask = jest.fn();
  const audioConf = tree
    .find('NavBar')
    .shallow()
    .find({ name: 'phone' })
    .parent();
  expect.assertions(3);
  await audioConf.props().onPress();
  expect(instance.goToBoardTask).toBeCalled();
  expect(instance.checkAudioConfPermission).toBeCalled();
  expect(tree.state().actionsMenu).toBe(false);
});

it('onPress of a navbar timetable button', async () => {
  Actions.currentScene = 'ChatRoomScene';
  Actions.Timeline = jest.fn();
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.goToTimeTable = jest.fn();
  const timeTable = tree
    .find('NavBar')
    .shallow()
    .find({ name: 'timetable' })
    .parent();
  await timeTable.props().onPress();
  expect(instance.goToTimeTable).toBeCalled();
  expect(Actions.Timeline).toBeCalled();
  expect(tree.state().actionsMenu).toBe(false);
});

it('onPress of a navbar from ChatRoomScene', () => {
  Actions.currentScene = 'ChatRoomScene';
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.goToRoomInfo = jest.fn();
  const navbar = tree.find('NavBar');
  navbar.props().onChatNavPress();
  expect(instance.goToRoomInfo).toBeCalled();
});

it('onPress of a navbar from other scene', () => {
  Actions.currentScene = 'NewsScene';
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  instance.goToRoomInfo = jest.fn();
  const navbar = tree.find('NavBar');
  navbar.props().onChatNavPress();
  expect(instance.goToRoomInfo).not.toBeCalled();
});

it('ChatMessageList shows announcement', () => {
  groupInfo.announcement = 'UT updates go here';
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ groupInfo });
  tree.update();
  const ann = tree.find('Text').at(0);
  expect(ann.props().children).toMatch(groupInfo.announcement);
});

it('ChatMessageList hides actionsMenu on start', () => {
  const tree = shallow(<ChatRoom {...props} />);
  tree.setState({ user: DbManager.user.loggedInUser });
  tree.update();
  const view = tree.find('Component').at(1);
  view.props().onStartShouldSetResponder();
  expect(tree.state().actionsMenu).toBe(false);
});

it('GiftedChat props', () => {
  const tree = shallow(<ChatRoom {...props} />);
  const instance = tree.instance();
  tree.setState({ readOnly: true, attachAudio: true, isIphoneX: true });
  tree.update();
  instance.onSend = jest.fn();
  instance.renderBubble = jest.fn();
  instance.renderAudioRecorder = jest.fn();
  instance.renderReadOnly = jest.fn();
  instance.onLoadEarlier = jest.fn();
  instance.renderComposer = jest.fn();
  const giftedChat = tree.find('GiftedChat');
  giftedChat.props().onSend();
  giftedChat.props().onLongPress();
  giftedChat.props().renderBubble();
  giftedChat.props().renderComposer();
  giftedChat.props().onLoadEarlier();
  const sendValue = giftedChat.props().renderSend();
  const actionsValue = giftedChat.props().renderActions();
  expect(instance.onSend).toBeCalled();
  expect(instance.renderBubble).toBeCalled();
  expect(instance.renderReadOnly).toBeCalled();
  expect(instance.onLoadEarlier).toBeCalled();
  expect(sendValue).toBeNull();
  expect(actionsValue).toBeNull();
  // readOnly is false
  tree.setState({ readOnly: false });
  tree.update();
  const gChat = tree.find('GiftedChat');
  gChat.props().renderComposer();
  expect(instance.renderComposer).toBeCalled();
});

it('GiftedChat parsePatterns', async () => {
  const tree = shallow(<ChatRoom {...props} />);
  const giftedChat = tree.find('GiftedChat');
  const parsePatterns = giftedChat.props().parsePatterns();
  await parsePatterns[0].onPress();
  expect(Linking.openURL).toBeCalled();

  // Linking throws an error
  Linking.openURL = jest.fn(() => Promise.reject(new Error('url error')));
  Alert.alert = jest.fn();
  await parsePatterns[0].onPress();
  expect(Linking.openURL).toBeCalled();
  expect(Alert.alert).toBeCalled();
});
