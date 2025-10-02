<!--非虚拟列表title固定-->
<template>
  <div class="addr">
    <div v-for="(key, idx) in keys" :key="key" class="group">
      <!-- sentinel 用来让 IntersectionObserver 判断是否已粘贴 -->
      <div :ref="el => setSentinel(el, idx)" :data-idx="idx" class="sticky-sentinel"></div>

      <div :ref="el => setTitleRef(el, idx)" class="title" @click="toggle(key)">
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
          <img v-if="item.avatar" :src="item.avatar" class="av lazy-img" />
          <div class="txt no-select">
            <div class="name">{{ item.name ?? item.groupName }}</div>
            <div v-if="item.memberCount" class="sub">{{ item.memberCount }} 人</div>
          </div>
        </li>

        <!-- 当分组为空时显示空状态（可选） -->
        <li v-if="(store[key]?.length ?? 0) === 0" class="empty">暂无内容</li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onBeforeUnmount, onMounted, ref } from "vue";
  import { useFriendsStore } from "@/store/modules/friends";

  /** keys + 联合类型 Key */
  const keys = ["newFriends", "groups", "contacts"] as const;
  type Key = (typeof keys)[number];

  /** 可替换为更精确的 store 类型 */
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
    const list = (store as any)[key] ?? [];
    if (!query.value) return list;
    const q = query.value.toLowerCase();
    return list.filter((it: any) => ((it.name ?? "") as string).toLowerCase().includes(q));
  }

  function onItemClick(item: any, key: Key) {
    store.type = key;
    store.shipInfo = item;
  }

  /* ---------- Sticky-enhancement (optional) ---------- */
  /* 用来保存 title 元素和 sentinel 元素的引用 */
  const titleRefs = ref<HTMLElement[]>([]);
  const sentinelRefs = ref<HTMLElement[]>([]);

  function setTitleRef(el: HTMLElement | null | any, idx: number) {
    if (el) titleRefs.value[idx] = el;
  }

  function setSentinel(el: HTMLElement | null | any, idx: number) {
    if (el) sentinelRefs.value[idx] = el;
  }

  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    // 数据懒加载
    if ((store.newFriends?.length ?? 0) === 0 && store.loadNewFriends) store.loadNewFriends();
    if ((store.groups?.length ?? 0) === 0 && store.loadGroups) store.loadGroups();
    if ((store.contacts?.length ?? 0) === 0 && store.loadContacts) store.loadContacts();

    // IntersectionObserver: 当 sentinel 离开视口（即 title 到达顶部）时给 title 加 .stuck
    // 这是一个增强效果，不影响 position: sticky 的功能
    observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const idxAttr = (entry.target as HTMLElement).dataset.idx;
          if (!idxAttr) continue;
          const idx = Number(idxAttr);
          const titleEl = titleRefs.value[idx];
          if (!titleEl) continue;

          // 当 sentinel 的 boundingClientRect.top < 0 时，意味着滚动已经越过 sentinel，title 处于粘性状态
          if (entry.boundingClientRect.top < 0 && titleEl.classList) {
            titleEl.classList.add("stuck");
          } else {
            titleEl.classList.remove("stuck");
          }
        }
      },
      {
        root: null, // 监听视窗（container .addr 也可，但这里使用视窗）
        threshold: [0]
      }
    );

    // 注册所有 sentinel
    sentinelRefs.value.forEach(s => {
      if (s) observer!.observe(s);
    });
  });

  onBeforeUnmount(() => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  });
</script>

<style lang="scss" scoped>
  /* 定义滚动条宽度 */
  @mixin scroll-bar($width: 5px) {
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
    overflow-y: auto;
    bottom: 0px;
    background: var(--side-bg, #fff); /* 确保 sticky 背景正确 */
    position: relative;
    z-index: 0;
    @include scroll-bar();
  }

  .group + .group {
    margin-top: 6px;
  }

  .group {
    position: relative; /* 方便内部 sticky 行为 */
  }

  /* sentinel 是一个 1px 高的占位元素，放在 title 之前用于 intersection 判断 */
  .sticky-sentinel {
    height: 1px;
  }

  /* 核心：让 title 粘性在容器顶部 */
  .title {
    display: flex;
    align-items: center;
    font-size: 14px;
    padding: 8px 6px;
    cursor: pointer;
    user-select: none;

    position: sticky;
    top: 0;
    z-index: 5;
    //background: inherit; /* 使用父背景色以避免透出下方内容 */
    background: #ffffff;
    /* 平滑衔接，避免透出滚动内容 */
    -webkit-backdrop-filter: blur(0px);
    backdrop-filter: blur(0px);
  }

  /* 当真的粘在顶部时加一条细小阴影作为视觉提示（由 IntersectionObserver 控制） */
  .title.stuck {
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
  }

  /* 让箭头和计数靠位更合理 */
  .title .arrow {
    width: 22px;
    display: inline-block;
    color: #aaa;
  }

  .title .count {
    margin-left: auto;
    font-size: 12px;
    background: #efefef;
    padding: 2px 6px;
    border-radius: 999px;
  }

  /* 列表样式 */
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
