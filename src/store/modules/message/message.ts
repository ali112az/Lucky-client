// // 导入必要的模块和工具
// import { StoresEnum, IMessageType, MessageContentType } from "@/constants";
// import api from "@/api/index";
// import { useUserStore } from "./user";
// import { useChatMainStore } from "./chat";
// import { useMappers, QueryBuilder } from "@/database";
// import { textToHighlight } from "@/utils/Strings";
// import { CreateScreenWindow } from "@/windows/screen";
// import SingleMessage from "@/database/entity/SingleMessage";
// import GroupMessage from "@/database/entity/GroupMessage";
// import IdleTaskExecutor from "@/utils/IdleTaskExecutor";
// import { storage } from "@/utils/Storage";

// // 数据库映射器
// const { singleMessageMapper, groupMessageMapper } = useMappers();
// // const { singleFts5Mapper, groupFts5Mapper } = useFTS5Mappers();

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
// }

// export const useMessageStore = defineStore(StoresEnum.MESSAGE, {
//   state: (): State => ({
//     messageList: [], // 聊天记录
//     historyMessageList: [], // 历史聊天记录
//     messageNum: 1, // 分页
//     messageSize: 15, // 分页条数
//     groupInfo: {}, // 当前群聊信息
//     currentUrls: [], // 当前聊天图片视频
//     messageCount: 0 // 当前聊天消息总数
//   }),
//   getters: {
//     // 剩余消息数量
//     remainingQuantity: state => Math.max(0, state.messageCount - state.messageNum * state.messageSize)
//   },
//   actions: {
//     /**
//      * 清除信息
//      */
//     handleReset() {
//       Object.assign(this, {
//         messageList: [],
//         historyMessageList: [],
//         messageNum: 1,
//         messageCount: 0,
//         currentUrls: [],
//         groupInfo: {}
//         // groupMemberList: {}
//       });
//     },

//     /**
//      * 发送消息
//      * @param {*} messages 消息内容集合
//      */
//     async handleSendMessage(messages: any[]) {
//       if (!messages || messages.length === 0) return;
//       const currentChat = chatStore.currentChat;
//       if (!currentChat) {
//         console.warn("没有当前会话，无法发送消息");
//         return;
//       }

//       // 将 messages 拆分为两类：文件类（image/video/file）与文本类
//       const fileMsgs = messages.filter(m => m.type === "image" || m.type === "video" || m.type === "file");
//       const textMsgs = messages.filter(m => m.type === "text");

//       // 1) 先处理文件类（并发上传并发送），确保文件消息先发（常见需求）
//       //    如果你想改为 "并行上传所有文件，然后再发送所有文本"，可以把下面改成先并行 upload，然后再发送文本。
//       for (const m of fileMsgs) {
//         try {
//           // content 期望是 File
//           const file: File = m.file;
//           if (!file) {
//             console.warn("文件消息缺少 file 对象", m);
//             continue;
//           }

//           this.uploadAndSendFile(
//             file,
//             currentChat,
//             m.type === "image"
//               ? MessageContentType.IMAGE.code
//               : m.type === "video"
//               ? MessageContentType.VIDEO.code
//               : MessageContentType.FILE.code
//           );
//         } catch (err) {
//           // 记录失败但继续处理后续消息
//           console.error("上传并发送文件失败", err, m);
//         }
//       }

//       // 2) 处理文本类（逐条发送）
//       for (const m of textMsgs) {
//         try {
//           // m.content 是完整文本（前端已合并 at 与文本），m 可能还包含 mentionedUserIds、mentionAll、replyMessage
//           const form = this.handleCreateMessageContext({ text: m.content }, currentChat, MessageContentType.TEXT.code, {
//             mentionedUserIds: Array.isArray(m.mentionedUserIds) ? m.mentionedUserIds : [],
//             mentionAll: !!m.mentionAll,
//             replyMessage: m.replyMessage // 如果 undefined 就不加入
//           });

//           const apiFn =
//             currentChat.chatType === IMessageType.SINGLE_MESSAGE.code ? api.SendSingleMessage : api.SendGroupMessage;
//           await this.sendSingle(form, currentChat, apiFn);
//         } catch (err) {
//           console.error("发送文本消息失败", err, m);
//         }
//       }
//     },

//     /**
//      * 发送单条（调用后端 API），内置简单重试机制
//      * sendFn(form) => Promise<response>
//      */
//     async sendSingle(formData: any, currentChat: any, sendFn: Function) {
//       try {
//         const res = await sendFn(formData);
//         // 成功后做本地创建消息（本地 UI）
//         // 注意：你原本调用 this.handleCreateMessage(currentChat.toId, res, currentChat.chatType, true)
//         // 保持不变
//         this.handleCreateMessage(currentChat.toId, res, currentChat.chatType, true);
//         return res;
//       } catch (err) {
//         console.error(`sendSingle failed`, err);
//       }
//     },

//     /**
//      * 上传文件并发送（保持向后兼容：上传后组装 form 并发送）
//      * 返回上传的响应（uploadRes）
//      */
//     async uploadAndSendFile(file: File, currentChat: any, contentType: number, opts: { retries?: number } = {}) {
//       if (!file || !currentChat) {
//         throw new Error("uploadAndSendFile 参数非法");
//       }

//       const formData = new FormData();
//       formData.append("file", file);

//       // 文件后缀
//       const getExtension = (fileName: string) => {
//         const idx = fileName.lastIndexOf(".");
//         if (idx === -1 || idx === fileName.length - 1) return "";
//         return fileName.slice(idx + 1).toLowerCase();
//       };

//       try {
//         const uploadRes: any = await api.UploadFile(formData);

//         // 组装消息体并发送（与原逻辑一致）
//         const form = this.handleCreateMessageContext(
//           {
//             ...uploadRes,
//             size: file.size,
//             suffix: getExtension(file.name)
//           },
//           currentChat,
//           contentType
//         );

//         const apiFn =
//           currentChat.chatType === IMessageType.SINGLE_MESSAGE.code ? api.SendSingleMessage : api.SendGroupMessage;
//         await this.sendSingle(form, currentChat, apiFn);

//         return uploadRes;
//       } catch (err) {
//         console.error(`uploadAndSendFile failed`, err);
//       }
//     },

//     /**
//      * 创建消息表单（增加 meta 支持）
//      * meta: { mentionedUserIds?: string[], mentionAll?: boolean, replyMessage?: object }
//      */
//     handleCreateMessageContext(content: any, chat: any, messageContentType: number, meta: any = {}) {
//       const { chatType, id } = chat || {};
//       const toKey = chatType === IMessageType.SINGLE_MESSAGE.code ? "toId" : "groupId";

//       // 基础 payload
//       const base = {
//         fromId: userStore.userId || storage.get("userId") || "",
//         messageBody: content,
//         messageTempId: generateTempId("msg"),
//         messageTime: Date.now(),
//         messageContentType: messageContentType,
//         messageType: chatType,
//         [toKey]: id || ""
//       };

//       // 合并可选 meta（只允许列入这三个字段）
//       const payload: any = { ...base };
//       if (meta) {
//         if (Array.isArray(meta.mentionedUserIds) && meta.mentionedUserIds.length > 0) {
//           payload.mentionedUserIds = Array.from(new Set(meta.mentionedUserIds));
//         }
//         if (typeof meta.mentionAll === "boolean") {
//           payload.mentionAll = meta.mentionAll;
//         }
//         if (meta.replyMessage && typeof meta.replyMessage === "object") {
//           payload.replyMessage = meta.replyMessage;
//         }
//       }

//       return payload;
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
//      * 获取当前会话消息
//      * @param chat 当前会话
//      */
//     async handleGetMessageList(chat: any) {
//       // 如果消息总数等于0 则获取消息数
//       if (this.messageCount == 0) await this.handleGetMessageCount();

//       const ownId = userStore.userId;
//       const userInfo = userStore.userInfo;

//       const offset = (this.messageNum - 1) * this.messageSize;
//       const isSingle = chat.chatType === IMessageType.SINGLE_MESSAGE.code;

//       // 为 currentChatGroupMemberMap 赋值一个默认空对象，确保第二次循环时不为空
//       chatStore.currentChatGroupMemberMap = chatStore.currentChatGroupMemberMap || [];

//       let messages = isSingle
//         ? await singleMessageMapper.findMessage(ownId, chat.toId, offset, this.messageSize)
//         : await groupMessageMapper.findMessage(ownId, chat.toId, offset, this.messageSize);

//       messages = messages.map((msg: any) => this.processMessage(msg, ownId, userInfo, chat));

//       // 将新消息追加到现有的消息列表中
//       this.messageList = [...messages, ...this.messageList];

//       // 根据 messageTime 对消息进行排序
//       //this.messageList.sort((a, b) => a.messageTime - b.messageTime);
//     },

//     /**
//      * 处理消息
//      * @param msg 消息对象
//      * @param ownId 当前用户ID
//      * @param userInfo 当前用户信息
//      * @param chat 当前会话
//      * @returns 处理后的消息对象
//      */
//     processMessage(msg: any, ownId: any, userInfo: any, chat: any) {
//       const isSystemMessage = msg.fromId == "000000"; // 系统消息类型

//       return {
//         ...msg,
//         messageBody: JSON.parse(msg.messageBody),
//         name: isSystemMessage
//           ? null
//           : ownId === msg.fromId
//           ? userInfo.name
//           : chatStore.currentChatGroupMemberMap[msg.fromId]?.name || chat.name,
//         avatar: isSystemMessage
//           ? null
//           : ownId === msg.fromId
//           ? userInfo.avatar
//           : chatStore.currentChatGroupMemberMap[msg.fromId]?.avatar || chat.avatar,
//         isOwner: ownId === msg.fromId
//       };
//     },

//     /**
//      * 异步获取消息总数
//      */
//     async handleGetMessageCount() {
//       const chat = chatStore.currentChat;
//       if (!chat) return;
//       if (chat.chatType === IMessageType.SINGLE_MESSAGE.code) {
//         this.messageCount = await singleMessageMapper.findMessageCount(chat.ownerId, chat.toId);
//         //console.log(this.messageCount)
//       } else {
//         this.messageCount = await groupMessageMapper.findMessageCount(chat.toId);
//       }
//     },

//     /**
//      * 创建消息
//      * @param chatId 会话ID
//      * @param message 消息内容
//      * @param messageType 消息类型
//      * @param isSender 是否发送者
//      */
//     handleCreateMessage(id: any, message: any, messageType: number, isSender: boolean = false) {
//       const currentChat = chatStore.currentChat;

//       // 当前会话id
//       if (currentChat?.id === id) {
//         const ownId = userStore.userId;
//         const userInfo = userStore.userInfo;

//         let user: any;

//         if (currentChat?.chatType === IMessageType.SINGLE_MESSAGE.code) {
//           user = {
//             name: currentChat?.name,
//             avatar: currentChat?.avatar
//           };
//         }
//         if (currentChat?.chatType === IMessageType.GROUP_MESSAGE.code) {
//           user = {
//             name: chatStore.currentChatGroupMemberMap[message.fromId].name,
//             avatar: chatStore.currentChatGroupMemberMap[message.fromId].avatar
//           };
//         }

//         this.messageList.push({
//           ...message,
//           name: ownId === message.fromId ? userInfo.name : user?.name,
//           avatar: ownId === message.fromId ? userInfo.avatar : user?.avatar,
//           isOwner: ownId === message.fromId
//         });
//         console.log("messageList", this.messageList);

//         // 自己发送消息 更新会话
//         if (isSender) {
//           chatStore.handleCreateOrUpdateChat(message, currentChat?.toId as any);
//         }
//       }
//       // 异步任务，将消息内容插入到数据库和索引库
//       executor
//         .addTask(deadline => {
//           this.handleInsertToDatabase(message, messageType);
//           console.log("Async to index databse task executed with time remaining:", deadline.didTimeout);
//         })
//         .runAllTasksImmediately();
//     },

//     /**
//      * 同步所有消息到数据库和索引库，用于查询消息
//      * @param messageType 消息类型
//      * @param message 消息内容
//      */
//     async handleInsertToDatabase(message: any, messageType: number) {
//       // 将消息内容转为json字符串
//       const ownerId = userStore.userId;
//       const record = { ...message, ownerId, messageBody: JSON.stringify(message.messageBody) };
//       delete record.messageTempId;

//       if (messageType === IMessageType.SINGLE_MESSAGE.code) {
//         singleMessageMapper.insert(record);
//         const text = message.messageBody.text;
//         if (text) singleMessageMapper.insertOrUpdateFTS({ ...record, messageBody: text });
//       } else {
//         groupMessageMapper.insert(record);
//         const text = message.messageBody.text;
//         if (text) groupMessageMapper.insertOrUpdateFTS({ ...record, messageBody: text });
//       }
//     },

//     /**
//      * 查询并收集媒体文件 URL
//      */
//     async handleSearchMessageUrl(msg: any): Promise<void> {
//       if (msg.messageType === IMessageType.SINGLE_MESSAGE.code) {
//         this.currentUrls = await singleMessageMapper.findMessageUrl(msg.fromId, msg.toId);
//       } else {
//         this.currentUrls = await groupMessageMapper.findMessageUrl(msg.groupId);
//       }
//     },

//     /**
//      * 删除消息
//      * @param message 消息
//      */
//     async handleDelectMessage(message: any) {
//       this.messageList = this.messageList.filter((item: any) => item.messageId !== message.messageId);
//       const id = message.messageId;
//       if (message.messageType === IMessageType.SINGLE_MESSAGE.code) {
//         await singleMessageMapper.deleteById(id);
//         await singleMessageMapper.deleteFTSById(id);
//       } else {
//         await groupMessageMapper.deleteById(id);
//         await groupMessageMapper.deleteFTSById(id);
//       }
//     },

//     async handleAddGroupMember(membersList: string[], isSingle: boolean = false) {
//       if (!membersList || membersList.length === 0) {
//         console.warn("Members list is empty.");
//         return;
//       }

//       const currentChat = chatStore.currentChat;

//       const formData = {
//         groupId: isSingle ? "" : currentChat?.id || "",
//         userId: storage.get("userId") || "",
//         memberIds: membersList,
//         type: isSingle ? IMessageType.SINGLE_MESSAGE.code : currentChat?.chatType || IMessageType.SINGLE_MESSAGE.code
//       };

//       try {
//         const res: any = await api.InviteGroupMember(formData);
//         debugger;
//         if (res) {
//           console.log("Group members added successfully.");
//         } else {
//           console.warn("Failed to add group members:", res?.message || "Unknown error");
//         }
//       } catch (error) {
//         console.error("Error while adding group members:", error);
//       }
//     },

//     handleUpdateMessage(message: any, updata: any) {
//       switch (parseInt(message.messageType)) {
//         case IMessageType.SINGLE_MESSAGE.code: // 单聊
//           singleMessageMapper.updateById(message.messageId, updata as any);
//           break;
//         case IMessageType.GROUP_MESSAGE.code: // 群聊
//           groupMessageMapper.updateById(message.messageId, updata as any);
//           break;
//       }
//       // 更新消息列表
//       const messageIndex = this.messageList.findIndex(item => item.messageId == message.messageId);
//       if (messageIndex != -1) {
//         // 更新消息列表
//         this.messageList[messageIndex] = message;
//       }
//     },

//     /**
//      * 打开截图窗口
//      */
//     handleShowScreeenShot() {
//       CreateScreenWindow(screen.availWidth, screen.availHeight);
//     },

//     /**
//      * 历史消息查询，先查索引库，再查消息库
//      * @param pageInfo 分页信息
//      * @param searchStr 查询字段
//      * @returns
//      */
//     async handleHistoryMessage(pageInfo: PageQuery, searchStr?: string) {
//       // const { currentChat } = chatStore;
//       // if (!currentChat) return;
//       // const fromId = storage.get("userId");
//       // // 高亮搜索关键词
//       // const highlightMessageBody = (str: string, item: any) => {
//       //   const messageBody = JSON.parse(item.messageBody);
//       //   if (str && messageBody.text?.includes(str)) {
//       //     messageBody.text = textToHighlight(str, messageBody.text);
//       //   }
//       //   return messageBody;
//       // };
//       // // 查询单聊记录
//       // if (currentChat?.chatType == IMessageType.SINGLE_MESSAGE.code) {
//       //   // 构建索引库查询条件
//       //   const query = new QueryBuilder<SingleMessage>();
//       //   const toId = currentChat?.id;
//       //   query.and(q =>
//       //     q
//       //       .eq("fromId", fromId)
//       //       .eq("toId", toId)
//       //       .or(q => q.eq("fromId", toId).eq("toId", fromId))
//       //   );
//       //   if (searchStr) {
//       //     query.like("messageBody", searchStr);
//       //   }
//       //   // 查询索引库
//       //   const result = await singleMessageMapper.pageFTS5Query(query, pageInfo.pageNum, pageInfo.pageSize);
//       //   if (!result.list.length) return result;
//       //   // 根据消息ID查询数据库中的消息
//       //   const messageIds = result.list.map((item: any) => item.messageId);
//       //   const messageList = await singleMessageMapper.findByIds(messageIds, "messageTime", "desc");
//       //   const { userId: ownId, userInfo } = userStore;
//       //   // 序列化消息列表
//       //   const formattedMessages = messageList.map(item => ({
//       //     ...item,
//       //     messageBody: highlightMessageBody(searchStr as string, item),
//       //     name: ownId === item.fromId ? userInfo.name : currentChat?.name,
//       //     avatar: ownId === item.fromId ? userInfo.avatar : currentChat?.avatar,
//       //     isOwner: ownId === item.fromId
//       //   }));
//       //   return { ...result, list: formattedMessages };
//       // }
//       // // 查询群聊记录
//       // if (currentChat?.chatType == IMessageType.GROUP_MESSAGE.code) {
//       //   // 构建索引库查询条件
//       //   const query = new QueryBuilder<GroupMessage>();
//       //   const groupId = currentChat?.id;
//       //   query.and(q => q.eq("ownerId", fromId).eq("groupId", groupId));
//       //   if (searchStr) {
//       //     query.like("messageBody", searchStr);
//       //   }
//       //   // 查询索引库
//       //   const result = await groupFts5Mapper.pageFTS5Query(query, pageInfo.pageNum, pageInfo.pageSize);
//       //   if (!result.list.length) return result;
//       //   // 根据消息ID查询数据库中的消息
//       //   const messageIds = result.list.map((item: any) => item.messageId);
//       //   const messageList = await groupMessageMapper.findByIds(messageIds, "messageTime", "desc");
//       //   const { userId: ownId, userInfo } = userStore;
//       //   // 序列化消息列表
//       //   const formattedMessages = messageList.map((item: any) => ({
//       //     ...item,
//       //     messageBody: highlightMessageBody(searchStr as string, item),
//       //     name: ownId === item.fromId ? userInfo.name : this.groupMemberList[item.fromId]?.name,
//       //     avatar: ownId === item.fromId ? userInfo.avatar : this.groupMemberList[item.fromId]?.avatar,
//       //     isOwner: ownId === item.fromId
//       //   }));
//       //   return { ...result, list: formattedMessages };
//       // }
//     },

//     /**
//      * 先查索引库再查数据库
//      * @param searchStr 搜索字符串
//      * @param global 是否全局查询
//      */
//     async handleSearchMessage(searchStr?: string, global: boolean = false) {}
//   },
//   persist: [
//     {
//       key: `${StoresEnum.MESSAGE}_local`,
//       paths: ["messageList"],
//       storage: localStorage
//     },
//     {
//       key: `${StoresEnum.MESSAGE}_session`,
//       paths: ["messageCount"],
//       storage: sessionStorage
//     }
//     // {
//     //   key: `${StoresEnum.MESSAGE}_store`,
//     //   paths: ["messageList"],
//     //   storage: tauriStorage,
//     // },
//   ]
// });

// // Helper: 构建消息体预览
// function parseMessageBody(body: string) {
//   try {
//     return JSON.parse(body);
//   } catch {
//     return { message: body };
//   }
// }

// function formatPreview(content: any) {
//   const code = parseInt(content.messageContentType, 10);
//   if (code === MessageContentType.TEXT.code) return content.messageBody.text;
//   return (
//     {
//       [MessageContentType.IMAGE.code]: "[图片]",
//       [MessageContentType.VIDEO.code]: "[视频]",
//       [MessageContentType.AUDIO.code]: "[语音]",
//       [MessageContentType.FILE.code]: "[文件]",
//       [MessageContentType.LOCAL.code]: "[位置]"
//     }[code] || "未知消息类型"
//   );
// }

// /** 生成客户端临时 message id（短且高度唯一） */
// function generateTempId(prefix = "tmp") {
//   return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
// }

// /** 延迟（毫秒） */
// function delay(ms: number) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }
