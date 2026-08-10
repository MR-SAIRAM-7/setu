// Icon generation instructions
// Since we can't generate actual PNG files, here's how to create them:

/*
To create the extension icons, you can:

1. Use an online tool like:
   - https://romannurik.github.io/IconKitchen/
   - https://www.canva.com/
   - https://www.figma.com/

2. Or use ImageMagick:
   convert -size 16x16 xc:'#6366f1' -pointsize 10 -fill white -gravity center -annotate +0+0 '🧠' icon16.png
   convert -size 48x48 xc:'#6366f1' -pointsize 30 -fill white -gravity center -annotate +0+0 '🧠' icon48.png
   convert -size 128x128 xc:'#6366f1' -pointsize 80 -fill white -gravity center -annotate +0+0 '🧠' icon128.png

3. Or create a simple SVG and convert:
   <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
     <rect width="128" height="128" fill="#6366f1" rx="20"/>
     <text x="64" y="90" font-size="80" text-anchor="middle" fill="white">🧠</text>
   </svg>

For the hackathon, you can use placeholder icons or create simple ones quickly.
*/

console.log('Icon generation guide - see comments above');
