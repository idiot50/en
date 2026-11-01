// Test catalog — all available test sets.
const Catalog = (() => {
  const YEARS = [
    { id: '2026', label: 'TOEIC 2026' },
    { id: '2025', label: 'TOEIC 2025' },
    { id: '2024', label: 'TOEIC 2024' },
    { id: '2023', label: 'TOEIC 2023' },
    { id: '2022', label: 'TOEIC 2022' },
    { id: 'Economy', label: 'TOEIC Cơ bản' },
  ];
  // Study4 Collection 1/2 are a personal offline copy: the files live outside every repo
  // (D:\en\study4-local, served by toeicets-local/server.py) and must never be published,
  // so these sets exist only when the app runs on this machine.
  if (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    YEARS.push({ id: 'Study4-C1', label: 'Study4 Collection 1' }, { id: 'Study4-C2', label: 'Study4 Collection 2' });
  }
  function tests(year) {
    return Array.from({ length: 10 }, (_, i) => ({
      id: `${year}/test${i+1}`,
      year,
      n: i + 1,
      label: `Đề ${i + 1}`,
    }));
  }
  function all() {
    const out = [];
    for (const y of YEARS) for (const t of tests(y.id)) out.push(t);
    return out;
  }
  return { YEARS, tests, all };
})();
