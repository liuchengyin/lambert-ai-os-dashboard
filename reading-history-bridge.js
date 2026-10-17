// Compact task cards are rendered directly by V5; load their styles only.
(function(){
  if(!document.querySelector('link[href="task-board-v6.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='task-board-v6.css';document.head.appendChild(l);
  }

})();
