const canvas = document.getElementById("network-canvas");
const ctx = canvas.getContext("2d");
const nodes = [];
const nodeCount = 70;
const mouse = { x: null, y: null, radius: 150 };

function initCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createNode(x, y) {
    return {
        x: x || Math.random() * canvas.width,
        y: y || Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        radius: Math.random() * 2 + 1
    };
}

function updateNodes() {
    nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off walls
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        // Mouse interaction
        if (mouse.x && mouse.y) {
            const dx = mouse.x - node.x;
            const dy = mouse.y - node.y;
            const distance = Math.hypot(dx, dy);

            if (distance > 0 && distance < mouse.radius) {
                const force = (mouse.radius - distance) / mouse.radius;
                node.vx -= (dx / distance) * force * 0.05;
                node.vy -= (dy / distance) * force * 0.05;
            }
        }
    });
}

function drawNodes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const styles = getComputedStyle(document.documentElement);
    ctx.fillStyle = styles.getPropertyValue('--node-color').trim();
    ctx.strokeStyle = styles.getPropertyValue('--line-color').trim();

    nodes.forEach((nodeA, i) => {
        // Draw connections
        nodes.slice(i + 1).forEach(nodeB => {
            const distance = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
            if (distance < 120) {
                ctx.beginPath();
                ctx.moveTo(nodeA.x, nodeA.y);
                ctx.lineTo(nodeB.x, nodeB.y);
                ctx.stroke();
            }
        });

        // Draw node
        ctx.beginPath();
        ctx.arc(nodeA.x, nodeA.y, nodeA.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function animate() {
    updateNodes();
    drawNodes();
    requestAnimationFrame(animate);
}

function initTheme() {
    const toggle = document.querySelector('.theme-toggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const savedTheme = localStorage.getItem('theme');

    function setTheme(isDark) {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    if (savedTheme) {
        setTheme(savedTheme === 'dark');
    } else {
        setTheme(false); // Default to light theme
    }

    toggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        setTheme(!isDark);
    });

    prefersDark.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            setTheme(false); // Keep light theme even when system preference changes
        }
    });

    // Observe theme changes to redraw nodes
    new MutationObserver(drawNodes).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
}

function init() {
    initCanvas();
    nodes.length = 0;
    for (let i = 0; i < nodeCount; i++) {
        nodes.push(createNode());
    }
}

// Event Listeners
window.addEventListener("pointermove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener("resize", init);

canvas.addEventListener("click", e => {
    nodes.push(createNode(e.clientX, e.clientY));
});

// Initialize
init();
initTheme();
animate();