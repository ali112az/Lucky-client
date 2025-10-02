<template>
  <div class="group-container">
    <!-- 搜索群成员 -->
    <div class="search-members">
      <el-input v-model="searchText" class="input-with-select" clearable placeholder="搜索群成员">
        <el-button slot="append" icon="el-icon-search"></el-button>
      </el-input>
    </div>

    <!-- 群成员列表 -->
    <div class="members-list">
      <el-row :gutter="20">
        <!-- 群成员 -->
        <el-col v-for="(item, index) in displayedMembers" :key="item.userId" :span="6">
          <el-image
            :alt="item.name"
            :src="item.avatar"
            class="member-avatar"
            fit="cover"
            @error="onAvatarError"
          ></el-image>
          <div :title="item.name ?? ''" class="member-name">{{ item.name }}</div>
        </el-col>
        <!-- 添加按钮 -->
        <el-col :span="6">
          <el-button class="member-btn" style="margin-bottom: 3px" @click="handleInviteDialog">
            <i class="iconfont icon-jia" style="margin-left: -5px"></i>
          </el-button>
          <div class="member-name">添加</div>
        </el-col>
      </el-row>
      <!-- 折叠按钮 -->
      <el-button v-if="filteredMembers.length > 16" class="group-footer" link type="primary" @click="toggleExpand">{{
          isExpanded ? "收起" : "查看更多"
        }}
      </el-button>
    </div>

    <el-divider></el-divider>

    <!-- 群聊名称和群公告表单 -->
    <div class="group-header">
      <div class="group-title">
        <el-form :model="groupInfo" label-position="top" label-width="80px">
          <el-form-item label="群聊名称">
            <p>{{ groupInfo.name }}</p>
            <!-- <el-input v-model="groupInfo.groupName" placeholder="请输入群聊名称"></el-input> -->
          </el-form-item>
          <el-form-item label="群公告">
            <p>{{ groupInfo.notice }}</p>
            <!-- <el-input type="textarea" :rows="3" v-model="groupInfo.groupNotice" placeholder="请输入群公告">
                        </el-input>  -->
          </el-form-item>
        </el-form>
      </div>
    </div>

    <el-divider></el-divider>

    <!-- 底部操作 -->
    <div class="group-footer">
      <el-button link style="color: #ff4d4f" @click="handleClearChat">清空聊天记录</el-button>
      <el-divider></el-divider>
      <el-button link style="color: #ff4d4f" @click="handleQuitGroup">退出群聊</el-button>
    </div>
  </div>

  <el-dialog
    :destroy-on-close="true"
    :model-value="inviteDialogVisible"
    class="status_change"
    title="邀请成员"
    width="550"
  >
    <SelectContact @handleAddGroupMember="handleAddGroupMember" @handleClose="handleInviteDialog"></SelectContact>
  </el-dialog>
</template>

<script lang="ts" setup>
  import SelectContact from "@/components/SelectContact/index.vue";
  import { ElMessageBox } from "element-plus";
  import { useChatMainStore } from "@/store/modules/chat";
  import { useMessageStore } from "@/store/modules/message";
  import { IMessageType } from "@/constants";

  import defaultImg from "@/assets/avatar/default.jpg";

  const chatStore = useChatMainStore();
  const messageStore = useMessageStore();

  const emit = defineEmits(["handleQuitGroup"]);

  onMounted(() => {
    // init();
  });

  const searchText = ref("");
  const isExpanded = ref(false);
  const inviteDialogVisible = ref(false);

  function onAvatarError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (img) img.src = defaultImg;
  }

  /**
   * 获取群详情
   */
  const groupInfo = computed(() => {
    const { currentChat } = chatStore;
    if (currentChat?.chatType == IMessageType.GROUP_MESSAGE.code) {
      return { name: currentChat?.name, notice: "" };
    }
    return {};
  });

  /**
   * 获取群成员
   */
  const filteredMembers = computed(() => {
    const { currentChatGroupMemberMap } = chatStore;
    const searchTextValue = searchText.value.trim().toLowerCase();
    let members = Object.values(currentChatGroupMemberMap);
    // 根据搜索文本过滤群成员
    if (!searchTextValue) {
      return members;
    }
    return members.filter((member: any) => member.name.includes(searchTextValue));
  });

  /**
   * 显示成员
   */
  const displayedMembers = computed(() => {
    // 根据 isExpanded 状态返回全部或部分群成员
    return isExpanded.value ? filteredMembers.value : filteredMembers.value.slice(0, 15);
  });

  /**
   * 控制展开
   */
  const toggleExpand = () => {
    isExpanded.value = !isExpanded.value;
  };

  const handleInviteDialog = () => {
    // 实现添加成员的逻辑
    inviteDialogVisible.value = !inviteDialogVisible.value;
  };

  /**
   * 邀请群成员
   * @param {*} arr
   */
  const handleAddGroupMember = (arr: any) => {
    if (arr && arr.length <= 0) return;
    // 实现添加成员的逻辑
    messageStore.handleAddGroupMember(arr, true);
  };

  const handleClearChat = () => {
    // 实现清空聊天记录的逻辑
  };

  const handleQuitGroup = () => {
    ElMessageBox.confirm("确定退出群聊?", "退出群聊", {
      distinguishCancelAndClose: true,
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    })
      .then(() => {
        emit("handleQuitGroup");

        // ElMessage({
        //     type: 'info',
        //     message: 'Changes saved. Proceeding to a new route.',
        // })
      })
      .catch(action => {
        // ElMessage({
        //     type: 'info',
        //     message:
        //         action === 'cancel'
        //             ? 'Changes discarded. Proceeding to a new route.'
        //             : 'Stay in the current route',
        // })
      });

    // 实现退出群聊的逻辑
  };
</script>

<style lang="scss" scoped>
  /* 定义滚动条宽度 */
  @mixin scroll-bar($width: 8px) {
    /* 隐藏滚动条按钮 */
    &::-webkit-scrollbar-button {
      display: none;
    }

    /* 背景色为透明 */
    &::-webkit-scrollbar-track {
      border-radius: 10px;
      background-color: transparent;
    }

    &::-webkit-scrollbar {
      width: $width;
      background-color: transparent;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 10px;
      background-color: rgba(0, 0, 0, 0.2);
    }
  }

  :deep(.el-divider) {
    position: relative;
    margin: 15px 2px;
  }

  p {
    margin: 0;
    font-size: 13px;
    color: #888;
  }

  .group-container {
    padding: 18px;
    overflow-x: hidden;
    overflow-y: scroll;
    @include scroll-bar();
  }

  .group-header {
    margin-bottom: 20px;
  }

  .search-members {
    margin-bottom: 20px;
  }

  .members-list {
    margin-bottom: 20px;
  }

  .group-footer {
    margin-top: 10px;
    text-align: center;
  }

  .member-avatar {
    width: 35px;
    height: 35px;
    border: 1px solid #eee;
    border-radius: 2px;
    object-fit: cover;
    margin: 0 auto;
    display: block;
  }

  .member-btn {
    width: 35px;
    height: 35px;
    border: 1px solid #eee;
    border-radius: 2px;
    object-fit: cover;
    display: block;
    margin: 0 auto;
  }

  .member-name {
    height: 20px;
    line-height: 20px;
    margin-top: 5px;
    font-size: 12px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .add-btn {
    width: 35px;
    height: 35px;
    font-size: 20px;
    line-height: 35px;
    text-align: center;
    border: none;
    background-color: #409eff;
    color: white;
  }

  .add-btn i {
    margin-right: 0;
  }

  .expand-btn {
    margin-top: 10px;
    cursor: pointer;
  }

  :deep(.el-dialog__header) {
    padding-bottom: 0px;
  }

  .status_change {
    .el-dialog__header {
      padding-bottom: 0px;
    }
  }
</style>
