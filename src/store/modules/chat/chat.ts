// import { defineStore } from "pinia";
// import { StoresEnum } from "@/constants";
// import api from "@/api/index";
// import Chats from "@/database/entity/Chats";
// import SingleMessage from "@/database/entity/SingleMessage";
// import GroupMessage from "@/database/entity/GroupMessage";
// import { QueryBuilder } from "@/database";
// import { useUserStore } from "./user";
// import { useMappers } from "@/database";
// import { ShowMainWindow } from "@/windows/main";
// import { storage } from "@/utils/Storage";
// import { useTray } from "@/hooks/useTray";
// import { useChatInput } from "@/hooks/useChatInput";
// import { IMessageType } from "@/constants";

// // 获取 mapper / hooks / 工具
// const { chatsMapper } = useMappers();
// const userStore = useUserStore();
// const { flash } = useTray();
// const logger = useLogger();
// const { buildMessagePreview, buildDraftMessagePreview, findChatIndex, removeMentionHighlightsFromHtml } =
//   useChatInput();

// // 简单的成员类型
// type User = { userId: string; name: string; avatar?: string | null };

// /**
//  * 聊天主存储（Pinia）
//  * 管理：会话列表 / 当前会话 / 消息预览 / 未读数 / 置顶 / 本地持久化等
//  */
// interface State {
//   chatList: Chats[]; // 会话列表
//   currentChat: Chats | null; // 当前会话
//   currentChatGroupMemberMap: any[]; // 当前群成员列表（供 name 映射）
//   isShowDetail: boolean; // 是否显示详情面板
//   ignoreAllList: string[]; // 忽略提醒的会话ID列表
//   chatDraftMap?: Record<string, any>; // 会话草稿列表
//   loading: boolean; // 全局 loading
//   error: string | null; // 错误信息
// }

// export const useChatMainStore = defineStore(StoresEnum.CHAT, {
//   state: (): State => ({
//     chatList: [],
//     currentChat: null,
//     currentChatGroupMemberMap: [],
//     isShowDetail: false,
//     ignoreAllList: [],
//     chatDraftMap: {},
//     loading: false,
//     error: null
//   }),

//   getters: {
//     // 当前会话名称
//     getCurrentName: state => state.currentChat?.name || "",
//     // 当前会话类型（直接返回 chatType，便于判断）
//     getCurrentType: state => state.currentChat?.chatType,
//     // 总未读
//     getTotalUnread: state => state.chatList.reduce((s, c) => s + (c.unread || 0), 0),
//     // 是否有当前会话（用于显示详情按钮）
//     getShowDetailBtn: state => !!state.currentChat,
//     // 是否显示详情
//     getShowDetail: state => state.isShowDetail,
//     // 有未读且非忽略的会话（注意：忽略逻辑可在前端扩展）
//     getHaveMessageChat: state => state.chatList.filter(c => c.unread > 0),
//     // 当前会话是否是群聊
//     getChatIsGroup: state =>
//       state.currentChat ? state.currentChat.chatType === IMessageType.GROUP_MESSAGE.code : false,
//     /**
//      * 返回当前群成员列表（排除自己）
//      * 支持 currentChatGroupMemberList 为：数组 / 对象字典 / JSON 字符串 / 仅 id 的数组
//      */
//     getCurrentGroupMembersExcludeSelf(): User[] {
//       const raw = this.currentChatGroupMemberMap;
//       const me = (userStore && userStore.userId) || storage.get("userId");

//       // 规范化 raw 为数组 any[]
//       let arr: any[] = [];
//       if (!raw) arr = [];
//       else if (typeof raw === "object") arr = Object.values(raw);
//       else arr = [];

//       // 映射到 Member | null（保留 null 以便后面用类型守卫过滤）
//       const mapped: Array<User | null> = arr.map((m: any) => {
//         if (m == null) return null;

//         // 情况 A: 元素是字符串/数字，视为 id（name 用 id 代替）
//         if (typeof m === "string" || typeof m === "number") {
//           const id = String(m);
//           return { userId: id, name: id, avatar: null };
//         }

//         // 情况 B: 元素是对象，尝试常见字段
//         const id = m.userId ?? m.id ?? m.uid ?? m.user_id ?? null;
//         if (id == null) return null;

//         const name = m.name ?? m.nick ?? m.nickname ?? m.displayName ?? m.username ?? String(id);
//         const avatar = m.avatar ?? m.avatarUrl ?? m.img ?? m.head ?? null;

//         return { userId: String(id), name: String(name ?? ""), avatar: avatar != null ? String(avatar) : null };
//       });

//       // 类型守卫：过滤掉 null，并告诉 TS 结果是 Member[]
//       function isMember(x: User | null): x is User {
//         return x != null && x.userId != null && x.userId !== "";
//       }

//       const result = mapped.filter(isMember).filter(m => String(m.userId) !== String(me));

//       return result;
//     }
//   },

//   actions: {
//     /**
//      * 根据 message 更新或创建会话（若不存在则从服务端拉取）
//      * @param message 可选：收到的消息对象（SingleMessage | GroupMessage）
//      * @param id 目标 userId 或 groupId（toId）
//      */
//     async handleCreateOrUpdateChat(message: SingleMessage | GroupMessage | undefined, id: string | number) {
//       const ownerId = userStore.userId;
//       // 构造查询条件：ownerId + toId
//       const qb = new QueryBuilder<Chats>().select().and(q => q.eq("ownerId", ownerId).eq("toId", id));

//       try {
//         this.setLoading(true);

//         // 1) 先查询本地 DB，看是否已有会话记录
//         const chats: Chats[] | null = await chatsMapper.selectList(qb);

//         if (Array.isArray(chats) && chats.length > 0) {
//           // 找到已有会话（取第一条）
//           const chat = chats[0];
//           const idx = this.localFindChatIndex(chat.chatId);

//           if (idx !== -1) {
//             // 本地 chatList 中已有对应会话：用 message 更新该会话（不认为这是 new 会话）
//             this.handleUpdateChatWithMessage(this.chatList[idx], message);
//             // 清理 messageContentType（与原代码一致的行为）
//             if ((this.chatList[idx] as any).messageContentType) {
//               delete (this.chatList[idx] as any).messageContentType;
//             }
//           } else {
//             // 本地 chatList 中没有，但 DB 中有 -> 将 DB 的 chat 对象合并 message 并加入本地列表
//             this.handleUpdateChatWithMessage(chat, message, true);
//             // 清理字段
//             if ((chat as any).messageContentType) delete (chat as any).messageContentType;
//             this.upsertChat(chat);
//           }
//         } else {
//           // 2) DB 中不存在：向服务端拉取会话信息
//           try {
//             const res = (await api.GetChat({ ownerId, toId: id })) as Chats;
//             if (!res) throw new Error("拉取会话信息失败");

//             // 将服务端返回的会话与 message 合并（此处标记为新会话 isNew=true）
//             this.handleUpdateChatWithMessage(res, message, true);
//             // 清理临时字段（如 messageContentType）
//             if ((res as any).messageContentType) delete (res as any).messageContentType;
//             // 插入本地列表并持久化
//             this.upsertChat(res);
//           } catch (apiErr: any) {
//             // 拉取会话失败时记录错误（但不必完全阻塞调用方）
//             this.setError(apiErr?.message || "拉取会话信息失败");
//             logger.warn("[chat-store] GetChat failed", apiErr);
//           }
//         }

//         // 最后根据新的列表排序
//         this.handleSortChatList();
//         this.setError(null);
//       } catch (err: any) {
//         this.setError(err?.message || "创建或更新会话失败");
//         logger.error("[chat-store] handleCreateOrUpdateChat error", err);
//       } finally {
//         this.setLoading(false);
//       }
//     },

//     /* -------------------- 初始化 & CRUD -------------------- */

//     /**
//      * 初始化：从数据库加载会话（仅在 chatList 为空时）
//      */
//     async handleInit() {
//       this.setLoading(true);
//       try {
//         if (!this.chatList || this.chatList.length === 0) {
//           const data = await chatsMapper.selectList();
//           if (Array.isArray(data) && data.length > 0) {
//             // 直接替换，保持响应性
//             this.chatList = data;
//           }
//         }
//         this.setError(null);
//       } catch (e: any) {
//         this.setError(e?.message || "初始化会话列表失败");
//       } finally {
//         this.setLoading(false);
//       }
//     },

//     /**
//      * 根据 chatId 查找在本地 chatList 的索引（包装 findChatIndex）
//      * 如果 findChatIndex 来自 hook，优先使用；否则 fallback
//      */
//     localFindChatIndex(chatId: string | number) {
//       try {
//         // findChatIndex 接口期望 chatList 与 chatId
//         return findChatIndex(this.chatList, chatId);
//       } catch (e) {
//         // 回退实现
//         return this.chatList.findIndex(c => c.chatId === chatId);
//       }
//     },

//     /**
//      * 把 chat 插入或更新到 chatList（保持引用一致性）
//      * - 如果已存在（通过 chatId 匹配），则更新字段并返回索引
//      * - 否则 push 新条目并返回新索引
//      */
//     upsertChat(chat: Chats): number {
//       if (!chat) return -1;
//       const idx = this.localFindChatIndex(chat.chatId);
//       if (idx !== -1) {
//         // 更新已有对象字段（保持响应性）
//         this.chatList[idx] = Object.assign({}, this.chatList[idx], chat);
//         return idx;
//       } else {
//         this.chatList.push(chat);
//         return this.chatList.length - 1;
//       }
//     },

//     /* -------------------- 当前会话操作 -------------------- */

//     /**
//      * 设置当前会话（接收的是 Chats 对象或 chatId）
//      * - 确保 currentChat 引用指向 chatList 内的对象（便于后续修改同步）
//      * - 会把 message 字段转为纯文本（去掉高亮 span）
//      */
//     async handleChangeCurrentChat(chatOrId: Chats | string | number): Promise<void> {
//       try {
//         // 保存草稿
//         this.saveDraftAsPreview();
//         if (!chatOrId) {
//           this.currentChat = null;
//           return;
//         }

//         // 支持传入 chatId 或 Chats 对象
//         let idx = -1;
//         if (typeof chatOrId === "object" && (chatOrId as Chats).chatId) {
//           idx = this.localFindChatIndex((chatOrId as Chats).chatId);
//         } else {
//           idx = this.localFindChatIndex(chatOrId as string | number);
//         }

//         if (idx === -1) {
//           // 未找到：若传入的是对象，则先插入
//           if (typeof chatOrId === "object") {
//             const newIdx = this.upsertChat(chatOrId as Chats);
//             this.currentChat = this.chatList[newIdx];
//           } else {
//             this.currentChat = null;
//             this.setError("会话不存在");
//           }
//         } else {
//           const chat = this.chatList[idx];
//           // 移除消息 html 中的 mention 高亮，设置为纯文本显示（避免在详情显示带 span）
//           try {
//             const dbChat: Chats | null = await chatsMapper.selectById(chat.chatId);
//             if (dbChat) {
//               chat.message = removeMentionHighlightsFromHtml(dbChat.message, {
//                 returnPlainText: true
//               });
//             }
//           } catch (e) {
//             // 如果去高亮失败，保留原始 message（但记录日志）
//             logger.warn("[chat-store] removeMentionHighlights failed", e);
//           }
//           this.currentChat = chat;
//           this.handleSortChatList();
//           // 打开会话时，通常会将 unread 置为 0（这里不自动持久化，调用方根据需求决定）
//         }
//       } catch (e: any) {
//         this.setError(e?.message || "设置当前会话失败");
//       }
//     },

//     /**
//      * 更新会话未读数（并持久化到数据库）
//      */
//     async handleUpdateReadStatus(chat: Chats, unread: number = 0): Promise<void> {
//       if (!chat) return;
//       const idx = this.localFindChatIndex(chat.chatId);
//       if (idx === -1) {
//         this.setError("会话未找到");
//         return;
//       }
//       this.chatList[idx].unread = unread;
//       try {
//         await chatsMapper.updateById(chat.chatId, { unread } as Chats);
//       } catch (e: any) {
//         logger.error("[chat-store] update unread fail", e);
//       }
//     },

//     /* -------------------- 新会话创建 / 切换 -------------------- */

//     /**
//      * 根据好友信息切换会话（单聊）
//      */
//     async handleCurrentChangeByFriend(friendInfo: { friendId: string | number; [k: string]: any }, chatType: number) {
//       const fromId = storage.get("userId");
//       const friendId = friendInfo.friendId;
//       // 先尝试在本地查找
//       const existingIdx = this.chatList.findIndex(c => c.toId === friendId && c.chatType === chatType);
//       if (existingIdx !== -1) {
//         await this.handleUpdateReadStatus(this.chatList[existingIdx], 0);
//         this.currentChat = this.chatList[existingIdx];
//         return;
//       }

//       // 否则向后台创建/拉取会话
//       try {
//         this.setLoading(true);
//         const res = (await api.CreateChat({ fromId, toId: friendId, chatType })) as Chats;
//         if (!res) throw new Error("创建会话失败");
//         // 使用更新函数把消息合并进会话
//         this.handleUpdateChatWithMessage(res);
//         this.upsertChat(res);
//         this.handleSortChatList();
//         this.currentChat = res;
//         this.setError(null);
//       } catch (e: any) {
//         this.setError(e?.message || "创建会话失败");
//       } finally {
//         this.setLoading(false);
//       }
//     },

//     /**
//      * 根据群信息切换会话（群聊）
//      */
//     async handleCurrentChangeByGroup(groupInfo: { groupId: string | number; [k: string]: any }, chatType: number) {
//       const fromId = storage.get("userId");
//       const groupId = groupInfo.groupId;
//       const existingIdx = this.chatList.findIndex(c => c.toId === groupId && c.chatType === chatType);
//       if (existingIdx !== -1) {
//         await this.handleUpdateReadStatus(this.chatList[existingIdx], 0);
//         this.currentChat = this.chatList[existingIdx];
//         return;
//       }

//       try {
//         this.setLoading(true);
//         const res = (await api.CreateChat({ fromId, toId: groupId, chatType })) as Chats;
//         if (!res) throw new Error("创建会话失败");
//         this.handleUpdateChatWithMessage(res);
//         this.upsertChat(res);
//         this.handleSortChatList();
//         this.currentChat = res;
//         this.setError(null);
//       } catch (e: any) {
//         this.setError(e?.message || "创建会话失败");
//       } finally {
//         this.setLoading(false);
//       }
//     },

//     /* -------------------- 消息与会话更新 -------------------- */

//     /**
//      * 删除消息（示意：仅移除 contentType 字段）
//      */
//     handleDeleteMessage(message: SingleMessage | GroupMessage) {
//       if (message && (message as any).messageContentType) {
//         delete (message as any).messageContentType;
//       }
//     },

//     /**
//      * 当收到/发送消息时，根据 message 更新会话 preview 等信息
//      * - chat: 目标会话（若不存在则传入从服务器拉取的 chat）
//      * - message: 可选，若存在则用其构建 preview，否则清空
//      * - isNew: 标识这是新会话（从服务器拉取），避免误触发未读计数
//      */
//     handleUpdateChatWithMessage(chat: Chats, message?: SingleMessage | GroupMessage, isNew: boolean = false) {
//       if (!chat) return;

//       try {
//         if (message) {
//           // 生成 preview（可能包含 html / plainText / originalText）
//           const preview = buildMessagePreview(message, {
//             currentUserId: storage.get("userId"),
//             highlightClass: "mention-highlight",
//             asHtml: true
//           });

//           // 非当前会话，并且不是新会话，则增加未读并闪烁系统托盘
//           if (String(chat.toId) !== String(this.currentChat?.toId) && !isNew) {
//             chat.unread = (chat.unread || 0) + 1;
//             // 设置高亮
//             chat.message = preview.html;
//             try {
//               flash(true);
//             } catch (e) {
//               logger.warn("[chat-store] flash tray failed", e);
//             }
//           } else {
//             // 当前会话
//             chat.message = preview.plainText;
//           }

//           // 更新时间/序列，用于排序
//           chat.messageTime = message.messageTime || Date.now();
//           chat.sequence = message.messageTime || Date.now();

//           // 异步写入 DB（捕获错误但不阻塞主流程）
//           chatsMapper
//             .insertOrUpdate({
//               ...chat,
//               message: preview.originalText == "" ? preview.plainText : preview.originalText
//             })
//             .catch(err => logger.warn("[chat-store] persist preview fail", err));
//         } else {
//           // 没有 message：将 chat 重置为默认值（内存 + 持久化）
//           chat.message = "";
//           chat.messageTime = Date.now();
//           chat.sequence = Date.now();
//           chat.unread = 0;

//           // 持久化空 message（同样浅拷贝）
//           const persistObj: Partial<Chats> = { ...chat, message: "" };
//           chatsMapper
//             .insertOrUpdate(persistObj)
//             .catch(err => logger.warn("[chat-store] persist empty preview fail", err));
//         }
//       } catch (e: any) {
//         logger.error("[chat-store] handleUpdateChatWithMessage error", e);
//       }
//     },
//     /* -------------------- 会话操作：删除 / 置顶 / 排序 -------------------- */

//     /**
//      * 删除会话（DB + 本地列表）
//      */
//     async handleDeleteChat(chat: Chats) {
//       if (!chat) return;
//       const idx = this.localFindChatIndex(chat.chatId);
//       if (idx !== -1) {
//         try {
//           await chatsMapper.deleteById(chat.chatId);
//         } catch (e) {
//           logger.warn("[chat-store] delete chat db fail", e);
//         }
//         this.chatList.splice(idx, 1);
//       }
//       if (this.currentChat?.chatId === chat.chatId) {
//         this.currentChat = null;
//       }
//     },

//     /**
//      * 切换置顶状态（并持久化）
//      */
//     async handlePinChat(chat: Chats) {
//       if (!chat) return;
//       try {
//         const idx = this.localFindChatIndex(chat.chatId);
//         if (idx === -1) return;
//         const newTop = (this.chatList[idx].isTop || 0) === 1 ? 0 : 1;
//         this.chatList[idx].isTop = newTop;
//         await chatsMapper.updateById(chat.chatId, { isTop: newTop } as Chats);
//         this.handleSortChatList();
//       } catch (e: any) {
//         this.setError(e?.message || "更新置顶状态失败");
//         throw e;
//       }
//     },

//     /**
//      * 排序会话列表（置顶优先 -> 时间倒序）
//      */
//     handleSortChatList(customList?: Chats[]) {
//       const list = customList || this.chatList;
//       this.chatList = [...list].sort((a, b) => {
//         const topDiff = (b.isTop || 0) - (a.isTop || 0);
//         if (topDiff !== 0) return topDiff;
//         return (b.messageTime || 0) - (a.messageTime || 0);
//       });
//     },

//     /* -------------------- 其它工具 -------------------- */

//     /**
//      * 将所有有未读的会话加入忽略列表（用于一键静默）
//      */
//     handleIgnoreAll() {
//       for (const item of this.getHaveMessageChat) {
//         if (!this.ignoreAllList.includes(String(item.chatId))) {
//           this.ignoreAllList.push(String(item.chatId));
//         }
//       }
//       logger.info("[chat-store] ignore all messages");
//     },

//     /**
//      * 点击跳转（显示主窗口并高亮当前会话）
//      */
//     async handleJumpToChat() {
//       if (this.currentChat) {
//         try {
//           ShowMainWindow();
//         } catch (e) {
//           logger.warn("[chat-store] open main window fail", e);
//         }
//       }
//     },

//     /**
//      * 保存当前会话的草稿预览（在 chatList 中显示 "[草稿] ..."）
//      * - 从 this.getDraft(chatId) 读取草稿 HTML（innerHTML）
//      * - 提取纯文本并截断为 snippet，用于 preview
//      * - 构造 stub 并调用 upsertChat，同时异步持久化到 DB（非阻塞）
//      */
//     async saveDraftAsPreview() {
//       const chatId = this.currentChat?.chatId;
//       if (!chatId) return;

//       const draftHtml = this.getDraft(chatId);
//       if (!draftHtml) return;

//       const preview = buildDraftMessagePreview(String(chatId), draftHtml ?? "");

//       if (preview) {
//         // 统一构造 stub（upsertChat 会负责更新或插入）
//         const stub: Partial<any> = {
//           chatId: chatId,
//           message: preview,
//           messageTime: Date.now()
//         };

//         try {
//           // 更新内存列表（upsert 会覆盖已有项或 push 新项）
//           this.upsertChat(stub as any);
//         } catch (err: any) {
//           // 保底日志（理应很少触发）
//           logger.warn("[chat-store] saveDraftAsPreview failed", err);
//         }
//       }
//     },

//     /**
//      * 根据会话id设置草稿
//      */
//     setDraft(chatId: string | number, html: string) {
//       if (!chatId) return;
//       const id = String(chatId);
//       if (!(this as any).chatDraftMap) (this as any).chatDraftMap = {};
//       (this as any).chatDraftMap[id] = html ?? "";
//     },

//     /**
//      * 根据会话id获取草稿
//      */
//     getDraft(chatId: string | number) {
//       if (!chatId) return "";
//       return ((this as any).chatDraftMap || {})[String(chatId)] || undefined;
//     },

//     /**
//      * 清空草稿
//      */
//     clearDraft(chatId: string | number) {
//       if (!chatId) return;
//       const id = String(chatId);
//       if ((this as any).chatDraftMap && id in (this as any).chatDraftMap) {
//         delete (this as any).chatDraftMap[id];
//       }
//     },

//     /* -------------------- 基础工具方法 -------------------- */

//     /**
//      * 设置 loading
//      */
//     setLoading(flag: boolean) {
//       this.loading = !!flag;
//     },

//     /**
//      * 设置错误信息（并记录日志）
//      */
//     setError(err: string | null) {
//       this.error = err;
//       if (err) logger.error?.("[chat-store] error:", err);
//     },

//     handleChatDetail() {
//       this.isShowDetail = !this.isShowDetail;
//     }
//   },

//   // 持久化配置（保持与原实现一致）
//   persist: [
//     {
//       key: `${StoresEnum.CHAT}_local`,
//       paths: ["chatDraftMap", "currentChatGroupMemberMap", "ignoreAllList"],
//       storage: localStorage
//     },
//     {
//       key: `${StoresEnum.CHAT}_session`,
//       paths: ["chatList", "currentChat"],
//       storage: sessionStorage
//     }
//   ],

//   // 跨窗口同步（保留你原有配置）
//   sync: {
//     paths: ["chatList"],
//     targetWindows: [StoresEnum.NOTIFY],
//     sourceWindow: StoresEnum.MAIN
//   }
// });
