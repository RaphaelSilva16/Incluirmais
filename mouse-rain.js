const mouseRain = document.querySelector('.mouse-rain');

if (mouseRain) {
  const trailLine = document.createElement('span');
  trailLine.className = 'mouse-trail-line';
  mouseRain.appendChild(trailLine);

  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let currentX = pointerX;
  let currentY = pointerY;
  let previousX = pointerX;
  let previousY = pointerY;
  let lastMove = performance.now();

  const updatePointer = (event) => {
    pointerX = event.clientX ?? pointerX;
    pointerY = event.clientY ?? pointerY;
    lastMove = performance.now();
  };

  const renderTrail = () => {
    const now = performance.now();
    const isMoving = now - lastMove < 150;

    currentX += (pointerX - currentX) * 0.12;
    currentY += (pointerY - currentY) * 0.12;

    const dx = currentX - previousX;
    const dy = currentY - previousY;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const midX = (previousX + currentX) / 2;
    const midY = (previousY + currentY) / 2;

    if (distance > 1) {
      trailLine.style.left = `${midX}px`;
      trailLine.style.top = `${midY}px`;
      trailLine.style.width = `${Math.max(34, distance + 52)}px`;
      trailLine.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
      trailLine.style.opacity = isMoving ? '1' : '0';
      trailLine.style.filter = isMoving ? 'blur(0.2px)' : 'blur(0)';
      trailLine.style.transform += isMoving ? ' scaleY(1.18)' : ' scaleY(0.8)';
    } else if (!isMoving) {
      trailLine.style.opacity = '0';
      trailLine.style.width = '4px';
      trailLine.style.left = `${pointerX}px`;
      trailLine.style.top = `${pointerY}px`;
      trailLine.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    }

    previousX = currentX;
    previousY = currentY;

    requestAnimationFrame(renderTrail);
  };

  window.addEventListener('pointermove', updatePointer);
  window.addEventListener('mousemove', updatePointer);
  document.addEventListener('pointermove', updatePointer);
  renderTrail();
}
