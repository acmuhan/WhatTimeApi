import { computed, onMounted, ref, watch } from 'vue';
import type { MainClockSource } from '../constants/time-dashboard';
import type { SourceKey, SourceStatus } from '../types';

export type DashboardTheme = 'dark' | 'light';
export type DashboardLocale = 'zh' | 'en';

export interface DashboardCopy {
  summary: {
    avgLatency: string;
    ok: string;
    stale: string;
    error: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    speedlineBadge: string;
    speedlineCopy: string;
    sourcePrefix: string;
    sourceUnknown: string;
    offsetPrefix: string;
    offsetEmpty: string;
    metaLastCal: string;
    metaNextCal: string;
    metaPip: string;
    pipRunning: string;
    pipAvailable: string;
    pipUnsupported: string;
    autoOn: string;
    autoOff: string;
    calibrating: string;
    calibrateNow: string;
    pipOpen: string;
    pipClose: string;
    pipUnsupportedAction: string;
    sourceControl: string;
    intervalControl: string;
    filterControl: string;
    millisControl: string;
    settingsMore: string;
    settingsLess: string;
    millisShow: string;
    millisHide: string;
    pipModePrefix: string;
    themeLabel: string;
    languageLabel: string;
    themeDark: string;
    themeLight: string;
    languageZh: string;
    languageEn: string;
    filters: Record<'all' | 'ok' | 'stale' | 'error', string>;
  };
  sourceFeed: {
    eyebrow: string;
    title: string;
  };
  groups: {
    countSuffix: string;
    empty: string;
    ok: { eyebrow: string; title: string };
    stale: { eyebrow: string; title: string };
    error: { eyebrow: string; title: string };
  };
  rankings: {
    latencyEyebrow: string;
    latencyTitle: string;
    offsetEyebrow: string;
    offsetTitle: string;
  };
  errors: {
    eyebrow: string;
    title: string;
    empty: string;
  };
  charts: {
    eyebrow: string;
    title: string;
    compareTab: string;
    focusTab: string;
    compareCaption: string;
    focusCaption: string;
    latencyMetric: string;
    offsetMetric: string;
    compareHeadline: string;
    compareSubline: string;
    focusSourceLabel: string;
    statusLabel: string;
    latencyLabel: string;
    offsetLabel: string;
    freshnessLabel: string;
    noData: string;
  };
  states: Record<SourceStatus, string>;
}

const STORAGE_THEME_KEY = 'whattime:theme';
const STORAGE_LOCALE_KEY = 'whattime:locale';

const SOURCE_LABELS: Record<DashboardLocale, Record<MainClockSource, string>> = {
  zh: {
    reference: '中位数',
    taobao: '淘宝',
    meituan: '美团',
    suning: '苏宁'
  },
  en: {
    reference: 'Median',
    taobao: 'Taobao',
    meituan: 'Meituan',
    suning: 'Suning'
  }
};

const COPY: Record<DashboardLocale, DashboardCopy> = {
  zh: {
    summary: {
      avgLatency: '平均延迟',
      ok: '正常源',
      stale: '回退源',
      error: '错误源'
    },
    hero: {
      eyebrow: 'REFERENCE CLOCK',
      title: '主时钟读数',
      speedlineBadge: 'VELOCITY LOCK',
      speedlineCopy: '快读模式已接管主时钟',
      sourcePrefix: 'SOURCE ·',
      sourceUnknown: '未知',
      offsetPrefix: '本地偏差',
      offsetEmpty: '-- 毫秒 · 本地偏差 --',
      metaLastCal: 'LAST CAL',
      metaNextCal: 'NEXT CAL',
      metaPip: 'PIP',
      pipRunning: '运行中',
      pipAvailable: '可开启',
      pipUnsupported: '不支持',
      autoOn: '自动：开启',
      autoOff: '自动：关闭',
      calibrating: '校准中...',
      calibrateNow: '立即校准',
      pipOpen: '画中画：开启',
      pipClose: '画中画：关闭',
      pipUnsupportedAction: '画中画：不支持',
      sourceControl: '主时钟源',
      intervalControl: '刷新间隔',
      filterControl: '分组筛选',
      millisControl: '毫秒显示',
      settingsMore: '更多设置',
      settingsLess: '收起更多设置',
      millisShow: '毫秒：显示',
      millisHide: '毫秒：隐藏',
      pipModePrefix: 'PiP 模式：',
      themeLabel: '主题',
      languageLabel: '语言',
      themeDark: '深色',
      themeLight: '浅色',
      languageZh: '中文',
      languageEn: 'EN',
      filters: {
        all: '全部',
        ok: '正常',
        stale: '过期',
        error: '错误'
      }
    },
    sourceFeed: {
      eyebrow: 'SOURCE FEED',
      title: '所有时间源，同步排进主赛道。'
    },
    groups: {
      countSuffix: '个数据源',
      empty: '当前分组暂无数据源。',
      ok: { eyebrow: 'Available', title: '正常数据源' },
      stale: { eyebrow: 'Fallback', title: '备用数据源' },
      error: { eyebrow: 'Unavailable', title: '错误数据源' }
    },
    rankings: {
      latencyEyebrow: 'Latency',
      latencyTitle: '延迟排名',
      offsetEyebrow: 'Offset',
      offsetTitle: '偏差排名'
    },
    errors: {
      eyebrow: 'Logs',
      title: '最近错误',
      empty: '暂无错误。'
    },
    charts: {
      eyebrow: 'TELEMETRY LAB',
      title: '动态图表舱',
      compareTab: '多源对比',
      focusTab: '单源聚焦',
      compareCaption: '用动画柱状图同时看多个数据源的速度与偏差。',
      focusCaption: '锁定单个数据源，查看更聚焦的读数状态。',
      latencyMetric: '延迟',
      offsetMetric: '偏差',
      compareHeadline: '多数据并列',
      compareSubline: '当前快照会随校准结果持续刷新。',
      focusSourceLabel: '聚焦数据源',
      statusLabel: '状态',
      latencyLabel: '延迟',
      offsetLabel: '偏差',
      freshnessLabel: '新鲜度',
      noData: '当前没有可供绘制的数据。'
    },
    states: {
      ok: '正常',
      stale: '过期',
      error: '错误'
    }
  },
  en: {
    summary: {
      avgLatency: 'Avg Latency',
      ok: 'Healthy',
      stale: 'Fallback',
      error: 'Error'
    },
    hero: {
      eyebrow: 'REFERENCE CLOCK',
      title: 'Reference Clock',
      speedlineBadge: 'VELOCITY LOCK',
      speedlineCopy: 'Speed-read mode is steering the main clock',
      sourcePrefix: 'SOURCE ·',
      sourceUnknown: 'Unknown',
      offsetPrefix: 'Local Offset',
      offsetEmpty: '-- ms · Local Offset --',
      metaLastCal: 'LAST CAL',
      metaNextCal: 'NEXT CAL',
      metaPip: 'PIP',
      pipRunning: 'Running',
      pipAvailable: 'Available',
      pipUnsupported: 'Unsupported',
      autoOn: 'Auto: On',
      autoOff: 'Auto: Off',
      calibrating: 'Calibrating...',
      calibrateNow: 'Calibrate Now',
      pipOpen: 'PiP: On',
      pipClose: 'PiP: Off',
      pipUnsupportedAction: 'PiP: Unsupported',
      sourceControl: 'Main Clock Source',
      intervalControl: 'Refresh Interval',
      filterControl: 'Group Filter',
      millisControl: 'Milliseconds',
      settingsMore: 'More Settings',
      settingsLess: 'Hide Settings',
      millisShow: 'Milliseconds: Show',
      millisHide: 'Milliseconds: Hide',
      pipModePrefix: 'PiP Mode: ',
      themeLabel: 'Theme',
      languageLabel: 'Language',
      themeDark: 'Dark',
      themeLight: 'Light',
      languageZh: '中文',
      languageEn: 'EN',
      filters: {
        all: 'All',
        ok: 'Healthy',
        stale: 'Stale',
        error: 'Error'
      }
    },
    sourceFeed: {
      eyebrow: 'SOURCE FEED',
      title: 'Every source lands on the same reading lane.'
    },
    groups: {
      countSuffix: 'sources',
      empty: 'No sources in this group right now.',
      ok: { eyebrow: 'Available', title: 'Healthy Sources' },
      stale: { eyebrow: 'Fallback', title: 'Fallback Sources' },
      error: { eyebrow: 'Unavailable', title: 'Failed Sources' }
    },
    rankings: {
      latencyEyebrow: 'Latency',
      latencyTitle: 'Latency Ranking',
      offsetEyebrow: 'Offset',
      offsetTitle: 'Offset Ranking'
    },
    errors: {
      eyebrow: 'Logs',
      title: 'Recent Errors',
      empty: 'No recent errors.'
    },
    charts: {
      eyebrow: 'TELEMETRY LAB',
      title: 'Animated Telemetry',
      compareTab: 'Compare',
      focusTab: 'Focus',
      compareCaption: 'Watch multiple sources animate side by side as the latest snapshot lands.',
      focusCaption: 'Lock onto one source for a tighter telemetry readout.',
      latencyMetric: 'Latency',
      offsetMetric: 'Offset',
      compareHeadline: 'Multi-source spread',
      compareSubline: 'The chart refreshes with every calibration pulse.',
      focusSourceLabel: 'Focused Source',
      statusLabel: 'Status',
      latencyLabel: 'Latency',
      offsetLabel: 'Offset',
      freshnessLabel: 'Freshness',
      noData: 'No chartable data is available right now.'
    },
    states: {
      ok: 'Healthy',
      stale: 'Stale',
      error: 'Error'
    }
  }
};

export function useDashboardUi() {
  const theme = ref<DashboardTheme>('dark');
  const locale = ref<DashboardLocale>('zh');

  onMounted(() => {
    try {
      const savedTheme = window.localStorage.getItem(STORAGE_THEME_KEY);
      const savedLocale = window.localStorage.getItem(STORAGE_LOCALE_KEY);

      if (savedTheme === 'dark' || savedTheme === 'light') {
        theme.value = savedTheme;
      }
      if (savedLocale === 'zh' || savedLocale === 'en') {
        locale.value = savedLocale;
      }
    } catch {
      // ignore storage issues
    }
  });

  watch(
    theme,
    (next) => {
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = next;
      }
      try {
        window.localStorage.setItem(STORAGE_THEME_KEY, next);
      } catch {
        // ignore storage issues
      }
    },
    { immediate: true }
  );

  watch(
    locale,
    (next) => {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
      }
      try {
        window.localStorage.setItem(STORAGE_LOCALE_KEY, next);
      } catch {
        // ignore storage issues
      }
    },
    { immediate: true }
  );

  const copy = computed(() => COPY[locale.value]);

  const mainClockSourceOptions = computed<ReadonlyArray<{ key: MainClockSource; label: string }>>(() => [
    { key: 'reference', label: sourceLabel('reference') },
    { key: 'taobao', label: sourceLabel('taobao') },
    { key: 'meituan', label: sourceLabel('meituan') },
    { key: 'suning', label: sourceLabel('suning') }
  ]);

  function sourceLabel(sourceKey: MainClockSource | SourceKey) {
    return SOURCE_LABELS[locale.value][sourceKey as MainClockSource];
  }

  function statusLabel(status: SourceStatus) {
    return copy.value.states[status];
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  function toggleLocale() {
    locale.value = locale.value === 'zh' ? 'en' : 'zh';
  }

  return {
    theme,
    locale,
    copy,
    mainClockSourceOptions,
    sourceLabel,
    statusLabel,
    toggleTheme,
    toggleLocale
  };
}
