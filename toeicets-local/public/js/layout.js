// Renders the shared sidebar + topbar.
function renderShell({ active, state }) {
  const sidebar = `
    <aside class="sidebar">
      <a class="brand" href="/">
        <img src="/favicon.svg?v=8" alt="logo"/>
        <div>
          <h1>TOEIC QUEST</h1>
          <small>Learn &amp; Level Up</small>
        </div>
      </a>
      <a class="nav-link ${active==='home'?'active':''}" href="/">
        <span class="icon">🏠</span><span>Trang chủ</span>
      </a>
      <a class="nav-link ${active==='tests'?'active':''}" href="/tests">
        <span class="icon">🎯</span><span>Bài thi</span>
      </a>
      <a class="nav-link ${active==='vocab'?'active':''}" href="/vocabulary">
        <span class="icon">📚</span><span>Từ vựng</span>
      </a>
      <a class="nav-link ${active==='grammar'?'active':''}" href="/grammar">
        <span class="icon">📖</span><span>Ngữ pháp</span>
      </a>
      <a class="nav-link" href="#" onclick="if(confirm('Reset toàn bộ tiến trình?')){localStorage.clear();location.reload();} return false;">
        <span class="icon">⚙️</span><span>Tùy chọn</span>
      </a>
    </aside>`;

  const topbar = `
    <div class="topbar">
      <div class="stat-pill streak"><span class="emoji">🔥</span>${state.streak}</div>
      <div class="stat-pill xp"><span class="emoji">⚡</span>${state.xp}</div>
      <div class="stat-pill hearts"><span class="emoji">❤️</span>5</div>
    </div>`;

  return { sidebar, topbar };
}
