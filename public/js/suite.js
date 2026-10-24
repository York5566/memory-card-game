const kind=document.querySelector('[data-suite]')?.dataset.suite;
if(['seating','dice'].includes(kind)){const m=await import('./suite-games.js');m[kind]();}
else if(['qr','image'].includes(kind)){const m=await import('./suite-media.js');m[kind==='image'?'images':'qr']();}
else if(['badges','certificates'].includes(kind)){const m=await import('./suite-paper.js');m.paper(kind);}
else if(kind==='whiteboard'){const m=await import('./suite-whiteboard.js');m.whiteboard();}
