import logUpdate from 'logUpdate';
const getStickyBottomText = (animIdx) => {
  const borderFrames = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '▊', '▋', '▌', '▍', '▎'];
  const leftBorderStr = borderFrames[animIdx % borderFrames.length] + ' ';
  return `\n\n\n\n${leftBorderStr}Write Your Task\n${leftBorderStr}\n${leftBorderStr}\n⏥⏥⏥⏥⏥⏥⏥⏥⏥⏥⏥⏥⏥⏥⏥⏥⏥⏥⏥\nstatus line`;
};
let frame = 0;
setInterval(() => {
  logUpdate(`Thinking... ${getStickyBottomText(frame++)}`);
}, 60);
