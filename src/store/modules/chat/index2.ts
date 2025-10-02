// // 导入必要的模块和工具
// import { defineStore } from "pinia";
// import { StoresEnum, MessageContentType, IMessageType } from "@/constants";
// import api from "@/api/index";
// import Chats from "@/database/entity/Chats";
// import SingleMessage from "@/database/entity/SingleMessage";
// import GroupMessage from "@/database/entity/GroupMessage";
// import { QueryBuilder } from "@/database/orm/BaseMapper";
// import { useUserStore } from "../user";
// import { useMappers } from "@/database";
// import { ShowMainWindow } from "@/windows/main";
// import { storage } from "@/utils/Storage";

// // 获取数据库映射器
// const { chatsMapper } = useMappers();
// const userStore = useUserStore();

// // 定义状态接口
// interface State {
//   chatList: Chats[];
//   currentChat: any;
//   isShowDetail: boolean;
//   ignoreAllList: any[]; // 忽略列表
//   chatDraftList: any[]; // 草稿列表
// }

// export const useChatMainStore = defineStore(StoresEnum.CHAT, {
//   state: (): State => ({
//     chatList: [], // 会话列表
//     currentChat: {}, // 当前会话
//     isShowDetail: false, // 是否显示聊天详情
//     ignoreAllList: [], // 忽略列表
//     chatDraftList: [], // 草稿列表
//   }),
//   getters: {
//     // 获取当前会话的名称
//     getCurrentName: ({ currentChat }) => currentChat?.name || "",

//     // 获取当前会话的类型
//     getCurrentType: ({ currentChat }) =>
//       currentChat?.chatType === IMessageType.SINGLE_MESSAGE.code
//         ? IMessageType.SINGLE_MESSAGE.code
//         : IMessageType.GROUP_MESSAGE.code,

//     // 获取未读消息总数
//     getTotalUnread: ({ chatList }) =>
//       chatList.reduce((sum, c) => sum + c.unread, 0),

//     // 当前有会话时显示按钮
//     getShowDetailBtn: ({ currentChat }) => currentChat !== null,

//     // 返回未读消息数大于0的会话
//     getHaveMessageChat: ({ chatList, ignoreAllList }) =>
//       chatList.filter((c) => c.unread > 0 && !ignoreAllList.includes(c.chatId)),
//   },
//   actions: {
//     /**
//      * 初始化会话列表
//      */
//     async handleInit() {
//       if (this.chatList.length == 0) {
//         const data = await chatsMapper.findAll();
//         this.chatList.push(...data);
//       }
//     },

//     handleToggleChatDetail(): void {
//       this.isShowDetail = !this.isShowDetail;
//     },

//     /**
//      * 忽略当前所有消息
//      */
//     handleIgnoreAll() {
//       this.getHaveMessageChat.forEach((item: any) => {
//         if (!this.ignoreAllList.includes(item.chatId)) {
//           this.ignoreAllList.push(item.chatId);
//         }
//       });
//       console.log("All messages ignored");
//     },

//     async handleJumpToChat() {
//       if (this.currentChat) ShowMainWindow(); // 显示主窗口
//     },

//     /**
//      * 根据ID获取聊天
//      * @param id 聊天ID
//      */
//     handleGetChat(id: any): Chats | undefined {
//       return this.chatList.find((c) => c.id === id);
//     },

//     /**
//      * 设置当前聊天
//      * @param chat 聊天对象
//      */
//     async handleChangeCurrentChat(chat: Chats): Promise<void> {
//       if (chat && this.chatList.length > 0) {
//         const idx = findChatIndex(this.chatList, chat.chatId);
//         if (idx !== -1) {
//           this.currentChat = this.chatList[idx];
//         } else {
//           this.currentChat = null;
//           throw new Error("会话不存在");
//         }
//       }
//     },

//     /**
//      * 更新指定会话的未读状态
//      * @param index 会话列表中的索引
//      * @param unread 未读数量（默认为0）
//      */
//     async handleUpdateReadStatus(
//       chat: Chats,
//       unread: number = 0
//     ): Promise<void> {
//       if (chat || this.chatList.length > 0) {
//         const idx = findChatIndex(this.chatList, chat.chatId);
//         if (idx === -1) throw new Error("会话未找到");
//         this.chatList[idx].unread = unread;
//         await chatsMapper.updateById(chat.chatId, { unread } as Chats);
//       }
//     },

//     /**
//      * 创建新会话
//      * @param friendInfo 好友信息
//      * @param chatType 类型
//      */
//     async handleCurrentChangeByFriend(friendInfo: any, chatType: number) {
//       const fromId = storage.get("userId");
//       const friendId = friendInfo.friendId;
//       const existingIdx = this.chatList.findIndex((c) => c.toId === friendId);
//       if (existingIdx !== -1) {
//         await this.handleUpdateReadStatus(this.chatList[existingIdx]);
//         this.currentChat = this.chatList[existingIdx];
//       } else {
//         const res: any = await api.CreateChat({
//           fromId,
//           toId: friendId,
//           chatType,
//         });
//         if (!res) throw new Error("创建会话失败");
//         this.handleUpdateChatWithMessage(res);
//         this.chatList.push(res);
//         chatsMapper.insertOrUpdate(res);
//         this.handleSortChatList();
//         this.currentChat = res;
//       }
//     },

//     handleDeleteMessage(message: any) {
//       delete (message as any).messageContentType;
//     },

//     /**
//      * 创建或更新会话
//      * @param message 消息对象
//      * @param id 对方的ID
//      */
//     async handleCreateOrUpdateChat(
//       message: SingleMessage | GroupMessage,
//       id: string | number
//     ) {
//       const ownerId = userStore.userId;
//       // 查询消息发送人与用户之间的会话，ownerId 为用户 toId 为消息发送人
//       const qb = new QueryBuilder<Chats>()
//         .select()
//         .and((q) => q.eq("ownerId", ownerId).eq("toId", id));

//       const chats: Chats[] = await chatsMapper.findByQueryBuilder(qb);

//       // 存在则更新会话
//       if (chats) {
//         const chat = chats[0];
//         // 根据会话id查找会话下标
//         const idx = findChatIndex(this.chatList, chat.chatId);

//         console.log("下标", idx);

//         if (idx != -1) {
//           // 更新会话
//           this.handleUpdateChatWithMessage(this.chatList[idx], message);

//           delete (this.chatList[idx] as any).messageContentType;

//           // 插入数据库
//           chatsMapper.insertOrUpdate(this.chatList[idx]);
//         } else {
//           console.warn(`会话ID ${chat.chatId} 在 chatList 中未找到。`);
//           // 可选：如果需要，可以将该会话添加到 chatList 中
//           // 更新会话
//           // this.handleUpdateChatWithMessage(chat, message);
//           // this.chatList.push(chat);
//           // chatsMapper.insertOrUpdate(chat);
//         }
//       } else {
//         // 不存在，则从服务器拉取会话信息
//         const res: any = await api.GetChat({ ownerId, toId: id });

//         // 更新会话
//         this.handleUpdateChatWithMessage(res, message, true);

//         delete (res as any).messageContentType;

//         this.chatList.push(res);

//         chatsMapper.insertOrUpdate(res);
//       }

//       this.handleSortChatList(); // 对会话列表进行排序,排序规则为按照消息时间从新到旧排序，注意代码中位置
//     },

//     /**
//      * 根据消息更新会话内容
//      * @param chat 要更新的会话
//      * @param message 消息对象
//      */
//     handleUpdateChatWithMessage(
//       chat: Chats,
//       message?: SingleMessage | GroupMessage,
//       isNew: boolean = false
//     ) {
//       if (message) {
//         chat.message = buildMessagePreview(message); // 更新消息内容
//         chat.messageTime = message.messageTime; // 更新消息时间
//         chat.sequence = message.messageTime; // 更新消息序列
//         if (chat.toId !== this.currentChat?.toId && !isNew) {
//           chat.unread += 1;
//         }
//       } else {
//         chat.message = ""; // 更新消息内容
//         chat.messageTime = Date.now(); // 更新消息时间
//         chat.sequence = Date.now(); // 更新消息序列
//         chat.unread = 0;
//       }
//     },

//     // 删除会话
//     async handleDeleteChat(chat: Chats) {
//       // 从列表中移除
//       const idx = findChatIndex(this.chatList, chat.chatId);
//       if (idx !== -1) {
//         await chatsMapper.deleteById(chat.chatId);
//         this.chatList.splice(idx, 1);
//       }
//       // 如果删除的是当前会话，清空当前会话
//       if (this.currentChat?.id === chat.id) {
//         this.currentChat = null;
//       }
//     },

//     // 修改 handlePinChat 方法
//     async handlePinChat(chat: Chats) {
//       try {
//         const newTop = chat.isTop === 1 ? 0 : 1;
//         // 使用索引直接修改数组元素以确保响应式更新
//         const idx = findChatIndex(this.chatList, chat.chatId);
//         if (idx !== -1) this.chatList[idx].isTop = newTop;
//         // 更新数据库
//         await chatsMapper.updateById(chat.chatId, { isTop: newTop } as Chats);
//         // 重新排序聊天列表
//         this.handleSortChatList();
//       } catch (error) {
//         console.error("更新置顶状态失败:", error);
//         throw error;
//       }
//     },

//     // 修改排序方法，考虑置顶状态
//     handleSortChatList(customList?: Chats[]): void {
//       const listToSort = customList || this.chatList;
//       // 创建新数组并进行排序，确保触发响应式更新
//       this.chatList = [...listToSort].sort((a, b) => {
//         // 首先按置顶状态排序（isTop: 1 置顶，0 不置顶）
//         const topDiff = (b.isTop || 0) - (a.isTop || 0);
//         if (topDiff) return topDiff;
//         // 其次按消息时间排序，确保处理 undefined 或 null 的情况
//         return (b.messageTime || 0) - (a.messageTime || 0);
//       });
//     },
//   },
//   persist: [
//     {
//       key: `${StoresEnum.CHAT}_local`,
//       paths: ["ignoreAllList"],
//       storage: localStorage,
//     },
//     {
//       key: `${StoresEnum.CHAT}_session`,
//       paths: ["chatList", "currentChat"],
//       storage: sessionStorage,
//     },
//   ],
// });

// // Helper: 查找 chatList 中索引
// function findChatIndex(chatList: Chats[], chatId: string | number): number {
//   return chatList.findIndex((item) => item.chatId === chatId);
// }

// // Helper: 构建消息预览
// function buildMessagePreview(message: any): string {
//   const code = parseInt(message.messageContentType, 10);
//   switch (code) {
//     case MessageContentType.TEXT.code:
//       return message.messageBody?.text || "";
//     case MessageContentType.IMAGE.code:
//       return "[图片]";
//     case MessageContentType.VIDEO.code:
//       return "[视频]";
//     case MessageContentType.AUDIO.code:
//       return "[语音]";
//     case MessageContentType.FILE.code:
//       return "[文件]";
//     case MessageContentType.LOCAL.code:
//       return "[位置]";
//     default:
//       return "未知消息类型";
//   }
// }
