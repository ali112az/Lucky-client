// // src/stores/messageStore.ts
// import { defineStore } from 'pinia';
// import { StoresEnum, IMessageType, MessageContentType } from '@/constants';
// import api from '@/api/index';
// import { useUserStore } from '../user';
// import { useChatMainStore } from '../chat';
// import { useMappers, useFTS5Mappers } from '@/database';
// import { saveFileDialog, downloadFile, getFileType, FileEnum, getEnumByExtension } from '@/utils/FileUpload';
// import { textToHighlight } from '@/utils/Strings';
// import { open } from '@tauri-apps/plugin-shell';
// import { CreateScreenWindow } from '@/windows/screen';
// import SingleMessage from '@/database/entity/SingleMessage';
// import GroupMessage from '@/database/entity/GroupMessage';
// import IdleTaskExecutor from '@/utils/IdleTaskExecutor';
// import { QueryBuilder } from '@/database/orm/BaseMapper';
// import { storage } from '@/utils/Storage';

// // 数据库映射器
// const { singleMessageMapper, groupMessageMapper } = useMappers();
// const { singleFts5Mapper, groupFts5Mapper } = useFTS5Mappers();

// // 其他 Store 实例
// const userStore = useUserStore();
// const chatStore = useChatMainStore();

// // 空闲任务执行器
// const executor = new IdleTaskExecutor();

// /**
//  * 消息列表分页参数
//  */
// interface PageParams {
//   pageNum: number;
//   pageSize: number;
// }

// /**
//  * Message 状态接口
//  */
// interface State {
//   // 当前聊天记录列表（实时）
//   messageList: Array<Record<string, any>>;
//   // 历史消息列表（查询索引库结果）
//   historyMessageList: Array<Record<string, any>>;
//   // 当前分页页码
//   messageNum: number;
//   // 每页消息条数
//   messageSize: number;
//   // 当前群聊信息
//   groupInfo: Record<string, any>;
//   // 当前聊天所有媒体文件 URL
//   currentUrls: string[];
//   // 聊天总消息数
//   messageCount: number;
//   // 当前群成员列表（用于群聊头像、昵称解析）
//   groupMemberList: Record<string, any>[];
// }

// export const useMessageStore = defineStore(StoresEnum.MESSAGE, {
//   state: (): State => ({
//     messageList: [],
//     historyMessageList: [],
//     messageNum: 1,
//     messageSize: 15,
//     groupInfo: {},
//     currentUrls: [],
//     messageCount: 0,
//     groupMemberList: [],
//   }),
//   getters: {
//     /**
//      * 计算剩余可加载消息数
//      */
//     remainingQuantity(state): number {
//       return state.messageCount - state.messageNum * state.messageSize;
//     },
//   },
//   actions: {
//     /**
//      * 重置所有状态
//      */
//     handleReset(): void {
//       this.messageNum = 1;
//       this.messageCount = 0;
//       this.currentUrls = [];
//       this.messageList = [];
//       this.historyMessageList = [];
//       this.groupInfo = {};
//       this.groupMemberList = [];
//     },

//     /**
//      * 发送消息(文本/媒体/文件)
//      * 支持批量发送
//      */
//     async handleSendMessage(messages: Array<{ type: string; content: any }>): Promise<void> {
//       if (!messages?.length) return;
//       const currentChat = chatStore.currentChat;
//       if (!currentChat) return;

//       // 封装发送单条消息
//       const sendSingle = async (formData: any, sendFn: Function): Promise<void> => {
//         try {
//           const res = await sendFn(formData);
//           this.handleCreateMessage(currentChat.toId, res, currentChat.chatType, true);
//         } catch (err) {
//           console.error('消息发送失败', err);
//         }
//       };

//       for (const msg of messages) {
//         switch (msg.type) {
//           case 'text': {
//             const form = this.createMessage({ message: msg.content }, currentChat, MessageContentType.TEXT.code);
//             const apiFn = currentChat.chatType === IMessageType.SINGLE_MESSAGE.code
//               ? api.SendSingleMessage
//               : api.SendGroupMessage;
//             await sendSingle(form, apiFn);
//             break;
//           }
//           case 'image':
//           case 'video':
//           case 'file': {
//             const contentType = msg.type === 'image'
//               ? MessageContentType.IMAGE.code
//               : msg.type === 'video'
//                 ? MessageContentType.VIDEO.code
//                 : MessageContentType.FILE.code;
//             await this.uploadAndSendFile(msg.content, contentType);
//             break;
//           }
//           default:
//             console.warn('未知消息类型', msg.type);
//         }
//       }
//     },

//     /**
//      * 上传文件并发送
//      * @param file 原始文件对象
//      * @param contentType 消息类型
//      */
//     async uploadAndSendFile(file: File, contentType: number): Promise<void> {
//       const fd = new FormData();
//       fd.append('file', file);
//       try {
//         // const uploadRes = await api.UploadFile(fd);
//         // 例: 发送已上传文件信息
//         // await this.handleSendMessage([{ type: 'file', content: uploadRes.data }]);
//       } catch (err) {
//         console.error('文件上传失败', err);
//       }
//     },

//     /**
//      * 构建消息发送体
//      */
//     createMessage(content: any, chat: any, contentType: number): Record<string, any> {
//       const { chatType, id } = chat;
//       const toKey = chatType === IMessageType.SINGLE_MESSAGE.code ? 'toId' : 'groupId';
//       return {
//         fromId: userStore.userId || storage.get('userId'),
//         messageBody: content,
//         messageTempId: Date.now().toString(),
//         messageContentType: contentType,
//         messageType: chatType,
//         [toKey]: id,
//       };
//     },

//     /**
//      * 获取聊天记录列表并累加
//      */
//     async handleGetMessageList(chat: any): Promise<void> {
//       const ownId = userStore.userId;
//       const offset = (this.messageNum - 1) * this.messageSize;
//       const isSingle = chat.chatType === IMessageType.SINGLE_MESSAGE.code;
//       let msgs = isSingle
//         ? await singleMessageMapper.findMessage(ownId, chat.toId, offset, this.messageSize)
//         : await groupMessageMapper.findMessage(ownId, chat.toId, offset, this.messageSize);

//       // 若为群聊，获取成员列表
//       if (!isSingle) {
//         this.groupMemberList = await api.GetGroupMember({ groupId: chat.toId }) || [];
//       }

//       // 处理并合并消息
//       msgs = msgs.map(m => this.processMessage(m, ownId, chat));
//       this.messageList = [...msgs, ...this.messageList];
//     },

//     /**
//      * 标准化消息体：JSON 反序列化 & 昵称头像
//      */
//     processMessage(msg: any, ownId: string, chat: any): Record<string, any> {
//       const body = JSON.parse(msg.messageBody);
//       const isSystem = msg.fromId === '000000';
//       let name: string | null = null;
//       let avatar: string | null = null;

//       if (!isSystem) {
//         if (ownId === msg.fromId) {
//           name = userStore.userInfo.name;
//           avatar = userStore.userInfo.avatar;
//         } else if (chat.chatType === IMessageType.GROUP_MESSAGE.code) {
//           const member = this.groupMemberList.find(m => m.userId === msg.fromId);
//           name = member?.name || chat.name;
//           avatar = member?.avatar || chat.avatar;
//         } else {
//           name = chat.name;
//           avatar = chat.avatar;
//         }
//       }

//       return { ...msg, messageBody: body, name, avatar, isOwner: ownId === msg.fromId };
//     },

//     /**
//      * 异步获取消息总数
//      */
//     handleGetMessageCount(): void {
//       executor.addTask(async () => {
//         const chat = chatStore.currentChat;
//         if (!chat) return;
//         if (chat.chatType === IMessageType.SINGLE_MESSAGE.code) {
//           this.messageCount = await singleMessageMapper.findMessageCount(chat.ownerId, chat.toId);
//         } else {
//           this.messageCount = await groupMessageMapper.findMessageCount(chat.toId);
//         }
//       }).runAllTasksImmediately();
//     },

//     /**
//      * 实时插入或更新消息并更新列表
//      */
//     handleCreateMessage(id: string, msg: any, msgType: number, isSender = false): void {
//       const chat = chatStore.currentChat;
//       if (!chat || chat.id !== id) return;
//       const ownId = userStore.userId;
//       const user = ownId === msg.fromId
//         ? { name: userStore.userInfo.name, avatar: userStore.userInfo.avatar }
//         : { name: chat.name, avatar: chat.avatar };

//       this.messageList.push({ ...msg, name: user.name, avatar: user.avatar, isOwner: ownId === msg.fromId });
//       if (isSender) {
//         chatStore.handleCreateOrUpdateChat(msg, chat.toId);
//       }
//       executor.addTask(() => this.handleInsertToDatabase(msg, msgType)).runAllTasksImmediately();
//     },

//     /**
//      * 插入消息到数据库及全文索引库
//      */
//     async handleInsertToDatabase(msg: any, msgType: number): Promise<void> {
//       const ownerId = userStore.userId;
//       const record = { ...msg, ownerId, messageBody: JSON.stringify(msg.messageBody) };
//       delete record.messageTempId;
//       if (msgType === IMessageType.SINGLE_MESSAGE.code) {
//         singleMessageMapper.insert(record);
//         const text = msg.messageBody.text;
//         if (text) singleFts5Mapper.insertOrUpdateFTS({ ...record, messageBody: text });
//       } else {
//         groupMessageMapper.insert(record);
//         const text = msg.messageBody.text;
//         if (text) groupFts5Mapper.insertOrUpdateFTS({ ...record, messageBody: text });
//       }
//     },

//     /**
//      * 查询并收集媒体文件 URL
//      */
//     async handleSearchMessageUrl(msg: any): Promise<void> {
//       if (msg.messageType === IMessageType.SINGLE_MESSAGE.code) {
//         this.currentUrls = await singleFts5Mapper.findMessageUrl(msg.fromId, msg.toId);
//       } else {
//         this.currentUrls = await groupFts5Mapper.findMessageUrl(msg.groupId);
//       }
//     },

//     /**
//      * 加载更多历史消息（分页）
//      */
//     handleMoreMessage(): void {
//       if (!chatStore.currentChat) return;
//       this.messageNum++;
//       this.handleGetMessageList(chatStore.currentChat);
//     },

//     /**
//      * 删除消息（实时 + 数据库）
//      */
//     async handleDeleteMessage(msg: any): Promise<void> {
//       this.messageList = this.messageList.filter(m => m.messageId !== msg.messageId);
//       const id = msg.messageId;
//       if (msg.messageType === IMessageType.SINGLE_MESSAGE.code) {
//         await singleMessageMapper.deleteById(id);
//         await singleFts5Mapper.deleteFTSById(id);
//       } else {
//         await groupMessageMapper.deleteById(id);
//         await groupFts5Mapper.deleteFTSById(id);
//       }
//     },

//     /**
//      * 添加群成员
//      */
//     async handleAddGroupMember(memberIds: string[], isSingle = false): Promise<void> {
//       if (!memberIds.length) return;
//       const chat = chatStore.currentChat;
//       if (!chat) return;
//       const form = {
//         groupId: isSingle ? '' : chat.id,
//         userId: storage.get('userId'),
//         memberIds,
//         type: isSingle ? IMessageType.SINGLE_MESSAGE.code : chat.chatType,
//       };
//       try {
//         const res = await api.InviteGroupMember(form);
//         if (res.code !== 200) console.warn('添加群成员失败', res.message);
//       } catch (err) {
//         console.error('添加群成员错误', err);
//       }
//     },

//     /**
//      * 下载并保存文件到本地
//      */
//     async handleDownloadAndSaveFile(msg: any): Promise<void> {
//       const file = msg.messageBody;
//       const fileEnum = getEnumByExtension(file.name);
//       if (!fileEnum) return;
//       const savePath = await saveFileDialog(file.name, getFileType(file.name), fileEnum);
//       if (savePath) downloadFile(file.url, savePath);
//       file.path = savePath;
//       const update = { messageBody: JSON.stringify(file) };
//       const mapper = msg.messageType === IMessageType.SINGLE_MESSAGE.code ? singleMessageMapper : groupMessageMapper;
//       await mapper.updateById(msg.messageId, update as any);
//       const idx = this.messageList.findIndex(m => m.messageId === msg.messageId);
//       if (idx !== -1) this.messageList[idx] = msg;
//     },

//     /**
//      * 打开本地文件
//      */
//     async handleOpenFile(path: string): Promise<void> {
//       try {
//         await open(path);
//       } catch (err) {
//         console.error('打开文件失败', err);
//       }
//     },

//     /**
//      * 显示截图窗口
//      */
//     handleShowScreeenShot(): void {
//       CreateScreenWindow(screen.availWidth, screen.availHeight);
//     },

//     /**
//      * 历史消息查询（全文检索 + 原始库查询）
//      */
//     async handleHistoryMessage(pageParams: PageParams, searchStr = ''): Promise<any> {
//       const chat = chatStore.currentChat;
//       if (!chat) return;
//       const fromId = storage.get('userId');
//       const isSingle = chat.chatType === IMessageType.SINGLE_MESSAGE.code;
//       const builder = new QueryBuilder<any>().and(q =>
//         isSingle
//           ? q.eq('fromId', fromId).eq('toId', chat.id).
//             or(sub => sub.eq('fromId', chat.id).eq('toId', fromId))
//           : q.eq('ownerId', fromId).eq('groupId', chat.id)
//       );
//       if (searchStr) builder.like('messageBody', searchStr);
//       const ftsMapper = isSingle ? singleFts5Mapper : groupFts5Mapper;
//       const dbMapper = isSingle ? singleMessageMapper : groupMessageMapper;

//       const result = await ftsMapper.pageFTS5Query(builder, pageParams.pageNum, pageParams.pageSize);
//       if (!result.list.length) return result;
//       const ids = result.list.map((i: any) => i.messageId);
//       const rawMsgs = await dbMapper.findByIds(ids, 'messageTime', 'desc');
//       const { userId: ownId, userInfo } = userStore;
//       const formatted = rawMsgs.map(item => {
//         const body = JSON.parse(item.messageBody);
//         if (searchStr && body.message) body.message = textToHighlight(searchStr, body.message);
//         const isOwner = ownId === item.fromId;
//         const name = isOwner
//           ? userInfo.name
//           : isSingle
//             ? chat.name
//             : this.groupMemberList.find(m => m.userId === item.fromId)?.name;
//         const avatar = isOwner
//           ? userInfo.avatar
//           : isSingle
//             ? chat.avatar
//             : this.groupMemberList.find(m => m.userId === item.fromId)?.avatar;
//         return { ...item, messageBody: body, name, avatar, isOwner };
//       });

//       return { ...result, list: formatted };
//     },

//     /**
//      * 全局或当前聊天全文搜索
//      */
//     async handleSearchMessage(searchStr = '', global = false): Promise<any> {
//       // TODO: 实现全局/当前会话搜索逻辑
//     },
//   },
//   persist: {
//     key: StoresEnum.MESSAGE,
//     paths: ['messageList', 'groupMemberList'],
//     storage: localStorage,
//   },
// });
