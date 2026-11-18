(function () {
  if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) return;

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inApp = /KAKAOTALK|NAVER\(inapp|DaumApps|Instagram|FBAN|FBAV|FB_IAB|Line\/|Twitter|Threads|everytimeApp/i.test(ua);

  const line = document.createElement("p");
  line.id = "install-line";
  line.hidden = true;
  const link = document.createElement("a");
  link.href = "#";
  link.setAttribute("role", "button");
  link.textContent = "홈 화면에 추가";
  const hint = document.createElement("span");
  hint.id = "install-hint";
  hint.hidden = true;
  hint.textContent = "공유 버튼을 누르고 '홈 화면에 추가'를 선택하세요.";
  line.append(link, hint);

  let deferred = null;

  function setVisible(on) {
    line.hidden = !on;
    if (!on) hint.hidden = true;
  }

  function attach() {
    const footer = document.getElementById("footer");
    if (footer && line.parentNode !== footer) footer.append(line);
  }

  function start() {
    attach();
    const footer = document.getElementById("footer");
    if (footer) new MutationObserver(attach).observe(footer, { childList: true });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    setVisible(true);
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    setVisible(false);
  });

  if (isIOS && !inApp) setVisible(true);

  link.addEventListener("click", (e) => {
    e.preventDefault();
    if (deferred) {
      const prompt = deferred;
      deferred = null;
      setVisible(false);
      prompt.prompt();
    } else if (isIOS) {
      hint.hidden = !hint.hidden;
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
