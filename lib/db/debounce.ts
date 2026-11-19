/** 続けて呼ばれたら、最後の呼び出しから ms たったときに1回だけ実行する（Realtime の通知が続けて届いても、読み直しは1回にする） */
export function debounced(fn: () => void, ms: number): { call: () => void; cancel: () => void } {
  let t: ReturnType<typeof setTimeout> | null = null;
  return {
    call: () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        fn();
      }, ms);
    },
    cancel: () => {
      if (t) clearTimeout(t);
      t = null;
    },
  };
}
