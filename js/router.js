// 화면 전환 라우터 (hash 기반)

const screens = {};

function registerScreen(name, { mount, unmount }) {
  screens[name] = { mount, unmount };
}

let currentScreen = null;

function navigate(name, params = {}) {
  if (currentScreen && screens[currentScreen]?.unmount) {
    screens[currentScreen].unmount();
  }
  const el = document.getElementById("app");
  el.innerHTML = "";
  currentScreen = name;
  if (screens[name]) {
    screens[name].mount(el, params);
  } else {
    el.innerHTML = `<p style="padding:24px">화면을 찾을 수 없어요: ${name}</p>`;
  }
  window.location.hash = name;
}
