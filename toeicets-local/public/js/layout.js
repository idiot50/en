// Renders the shared sidebar + topbar.
function renderShell({ active, state }) {
  const au = (typeof window !== 'undefined') ? window.__authUser : null;
  const accountHtml = au
    ? `<a class="nav-link ${active==='profile'?'active':''}" id="nav-account" href="/profile"><span class="icon">👤</span><span>${au.name || 'Tài khoản'}</span></a>`
    : `<a class="nav-link ${active==='login'?'active':''}" id="nav-account" href="/login"><span class="icon">🔐</span><span>Đăng nhập</span></a>`;
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
      <a class="nav-link ${active==='quick'?'active':''}" href="/quick">
        <span class="icon">⚡</span><span>Kiểm tra nhanh</span>
      </a>
      <a class="nav-link ${active==='drill'?'active':''}" href="/drill">
        <span class="icon">🔁</span><span>Ôn theo Part</span>
      </a>
      <a class="nav-link ${active==='part2'?'active':''}" href="/part2">
        <span class="icon">🎧</span><span>100 câu Part 2</span>
      </a>
      <a class="nav-link ${active==='dictation'?'active':''}" href="/dictation">
        <span class="icon">✍️</span><span>Chép chính tả</span>
      </a>
      <a class="nav-link ${active==='mistakes'?'active':''}" href="/mistakes">
        <span class="icon">🩹</span><span>Sổ lỗi sai</span>
      </a>
      <a class="nav-link ${active==='history'?'active':''}" href="/history">
        <span class="icon">📅</span><span>Lịch sử luyện tập</span>
      </a>
      <a class="nav-link ${active==='roadmap'?'active':''}" href="/roadmap">
        <span class="icon">📈</span><span>Lộ trình 650</span>
      </a>
      <a class="nav-link ${active==='study'?'active':''}" href="/study">
        <span class="icon">🧠</span><span>Học &amp; Ôn</span>
      </a>
      <a class="nav-link ${active==='notes'?'active':''}" href="/notes">
        <span class="icon">📒</span><span>Sổ từ vựng</span>
      </a>
      <a class="nav-link ${active==='vocab'?'active':''}" href="/vocabulary">
        <span class="icon">📚</span><span>Từ vựng</span>
      </a>
      <a class="nav-link ${active==='grammar'?'active':''}" href="/grammar">
        <span class="icon">📖</span><span>Ngữ pháp</span>
      </a>
      <a class="nav-link ${active==='blog'?'active':''}" href="/blog">
        <span class="icon">📰</span><span>Blog</span>
      </a>
      ${accountHtml}
      <a class="nav-link" href="#" onclick="if(confirm('Reset toàn bộ tiến trình trên máy này?')){localStorage.clear();location.reload();} return false;">
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
