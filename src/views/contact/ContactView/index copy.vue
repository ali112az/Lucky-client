<!--非虚拟列表-->
<template>
  <div class="addr">
    <div v-for="key in keys" :key="key" class="group">
      <div class="title" @click="toggle(key)">
        <span class="arrow">
          <i
            :style="{ transform: isOpen[key] ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }"
            class="iconfont icon-right"
          ></i>
        </span>
        <span>{{ titles[key] }}</span>
        <span v-if="counts[key]" class="count">{{ counts[key] }}</span>
      </div>

      <ul v-show="isOpen[key]" class="list">
        <li v-for="item in filteredList(key)" :key="item.id" class="item" @click="onItemClick(item, key)">
          <img v-if="item.avatar" :src="item.avatar" class="av" />
          <div class="txt no-select">
            <div class="name">{{ item.name ?? item.groupName }}</div>
            <div v-if="item.memberCount" class="sub">{{ item.memberCount }} 人</div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref } from "vue";
  import { useFriendsStore } from "@/store/modules/friends";

  /** keys + 联合类型 Key */
  const keys = ["newFriends", "groups", "contacts"] as const;
  type Key = (typeof keys)[number];

  /** 可替换为更精确的 store 类型（这里给个宽松的接口以兼容现有实现） */
  type StoreLike = {
    newFriends?: any[];
    groups?: any[];
    contacts?: any[];
    shipInfo?: any;
    type?: Key;
    loadNewFriends?: () => void;
    loadGroups?: () => void;
    loadContacts?: () => void;
  };

  const store = useFriendsStore() as unknown as StoreLike;

  const query = ref("");
  const isOpen = ref<Record<Key, boolean>>({
    newFriends: false,
    groups: false,
    contacts: false
  });

  const titles: Record<Key, string> = {
    newFriends: "新的朋友",
    groups: "群聊",
    contacts: "联系人"
  };

  const counts = computed<Record<Key, number>>(() => ({
    newFriends: store.newFriends?.length ?? 0,
    groups: store.groups?.length ?? 0,
    contacts: store.contacts?.length ?? 0
  }));

  function toggle(key: Key) {
    isOpen.value[key] = !isOpen.value[key];
  }

  function filteredList(key: Key) {
    const list = store[key] ?? [];
    if (!query.value) return list;
    const q = query.value.toLowerCase();
    return list.filter((it: any) => (it.name ?? "").toLowerCase().includes(q));
  }

  function onItemClick(item: any, key: Key) {
    store.type = key;
    store.shipInfo = item;
  }

  onMounted(() => {
    if ((store.newFriends?.length ?? 0) === 0 && store.loadNewFriends) store.loadNewFriends();
    if ((store.groups?.length ?? 0) === 0 && store.loadGroups) store.loadGroups();
    if ((store.contacts?.length ?? 0) === 0 && store.loadContacts) store.loadContacts();
  });
</script>

<style lang="scss" scoped>
  /* 定义滚动条宽度 */
  @mixin scroll-bar($width: 5px) {
    /* 背景色为透明 */
    &::-webkit-scrollbar-track {
      border-radius: 10px;
      background-color: transparent;
    }

    &::-webkit-scrollbar {
      width: $width;
      height: 10px;
      background-color: transparent;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 10px;
      background-color: rgba(0, 0, 0, 0.1);
    }
  }

  .addr {
    max-width: 420px;
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    color: #222;
    border-right: 1px solid var(--side-border-right-color);
    overflow-y: scroll;
    bottom: 0px;
    @include scroll-bar();
  }

  .group + .group {
    margin-top: 6px;
  }

  .title {
    display: flex;
    align-items: center;
    font-size: 14px;
    padding: 8px 6px;
    cursor: pointer;
    user-select: none;

    .arrow {
      width: 22px;
      display: inline-block;
      color: #aaa;
    }

    .count {
      margin-left: auto;
      font-size: 12px;
      background: #efefef;
      padding: 2px 6px;
      border-radius: 999px;
    }
  }

  .list {
    list-style: none;
    padding: 0 6px 6px 28px;
    margin: 0;
  }

  .item {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 6px;
    border-radius: 6px;
    cursor: pointer;
  }

  .item:hover {
    background: #f7f7f7;
  }

  .av {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    object-fit: cover;
  }

  .txt {
    display: flex;
    flex-direction: column;
  }

  .name {
    font-size: 14px;
  }

  .sub {
    font-size: 12px;
    color: #888;
  }

  .empty {
    padding: 8px 6px;
    color: #999;
    font-size: 13px;
  }
</style>
