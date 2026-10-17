// Built-in demo song, written in alphaTex (alphaTab's text format) so it ships without a binary file.
// It is an original practice groove in E minor; strings are numbered 1 (G) to 4 (E).
(function () {
  const bar = (notes) => notes.join(' ');
  const eighths = (n) => Array(8).fill(n + '.8');

  const em8 = bar(['0.4.8', '0.4.8', '2.2.8', '0.4.8', '0.4.8', '0.4.8', '2.2.8', '2.3.8']);
  const c8 = bar(['3.3.8', '3.3.8', '5.2.8', '3.3.8', '3.3.8', '3.3.8', '5.2.8', '3.4.8']);
  const g8 = bar(['3.4.8', '3.4.8', '5.3.8', '3.4.8', '3.4.8', '3.4.8', '5.3.8', '5.3.8']);
  const d8 = bar(['5.3.8', '5.3.8', '7.2.8', '5.3.8', '5.3.8', '5.3.8', '4.3.8', '2.3.8']);
  const verse = [em8, c8, g8, d8];

  const preA = bar(eighths('0.3'));
  const preC = bar(eighths('3.3'));
  const preD = bar(['5.3.8', '5.3.8', '5.3.8', '5.3.8', '5.3.4', '7.3.4']);
  const preB = bar(['2.3.4', '2.3.4', '2.3.8', '2.3.8', '4.2.8', '2.2.8']);
  const pre = [preA, preC, preD, preB];

  const chC = bar(['3.3.4', '5.2.4', '3.3.8', '3.3.8', '5.2.4']);
  const chG = bar(['3.4.4', '5.3.4', '3.4.8', '3.4.8', '5.3.4']);
  const chD = bar(['5.3.4', '7.2.4', '5.3.8', '5.3.8', '7.2.4']);
  const chEm = bar(['0.4.4', '2.3.4', '0.4.8', '2.2.8', '0.2.8', '2.3.8']);
  const chorus = [chC, chG, chD, chEm, chC, chG, chD, bar(['0.4.4', '2.3.4', '0.4.2'])];

  // The last chorus ends on a held note, so it is a slightly different version.
  const lastChorus = chorus.slice(0, 7).concat([bar(['0.4.1'])]);

  const bridge = [
    bar(['0.3.2', '0.3.4', '2.3.4']),
    bar(['3.3.2', '3.3.4', '5.3.4']),
    bar(['3.4.2', '3.4.4', '2.4.4']),
    bar(['2.3.2', 'r.4', '2.3.4'])
  ];

  const intro = [bar(['0.4.4', 'r.4', 'r.4', '2.3.8', '0.4.8']), bar(['0.4.4', 'r.4', 'r.4', '2.3.8', '0.4.8']), em8, d8];
  const outro = [em8, c8, bar(['0.4.2', '2.2.2']), bar(['0.4.1'])];

  const parts = [
    ['Intro', intro],
    ['Verse 1', verse.concat(verse)],
    ['Pre-chorus', pre],
    ['Chorus', chorus],
    ['Verse 2', verse.concat(verse)],
    ['Pre-chorus', pre],
    ['Chorus', chorus],
    ['Bridge', bridge.concat(bridge)],
    ['Chorus', lastChorus],
    ['Outro', outro]
  ];

  const body = parts
    .map(([name, bars]) => bars.map((b, i) => (i === 0 ? `\\section "${name}" ` : '') + b).join(' |\n'))
    .join(' |\n');

  window.DEMO_SONG = {
    title: 'Low Road (demo)',
    artist: 'Setcards practice groove',
    tex: `\\title "Low Road (demo)"
\\artist "Setcards practice groove"
\\tempo 104
.
\\track "Bass Guitar"
\\staff {tabs}
\\tuning (G2 D2 A1 E1)
\\instrument 33
${body} |`
  };
})();
