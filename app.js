const places = {
    settlement: {
        code: "ТОЧКА 01 / ПОСЕЛЕНИЕ",
        title: "За закрытыми дверями.",
        text: "Обыскивай дома и контейнеры. Внутри могут остаться припасы, снаряжение и материалы для следующей вылазки.",
    },
    garage: {
        code: "ТОЧКА 02 / ГАРАЖИ",
        title: "Остатки прежней жизни.",
        text: "Гаражи и хозяйственные постройки — ещё один повод свернуть с дороги. Осматривай помещения и проверяй хранилища.",
    },
    forest: {
        code: "ТОЧКА 03 / ЛЕС",
        title: "В тишине ты не один.",
        text: "За пределами поселений начинается лес. Собирай ресурсы, наблюдай за животными и будь готов к встрече с волками.",
    },
};
const mapViewport = document.querySelector(".interactive-map");
const mapCanvas = document.querySelector(".map-canvas");
const mapImage = mapCanvas.querySelector("img");
const resetMap = document.querySelector("#reset-map");
// Coordinates refer to the original map image, independent of viewport size.
const mapLocations = {
    settlement: { x: 0.24, y: 0.65 },
    garage: { x: 0.72, y: 0.24 },
    forest: { x: 0.36, y: 0.17 },
};
let focusedPlace = null;
// Map settings: duration in milliseconds and magnification relative to the overview.
const mapSettings = { durationMs: 600, zoom: 2.5 };
let camera = null;
let animationFrame = 0;
function paintCamera(value) {
    camera = value;
    mapCanvas.style.transform = `translate(${value.x}px, ${value.y}px) scale(${value.scale})`;
    mapCanvas.style.setProperty("--pin-scale", 1 / value.scale);
}
function renderMap(animate = false) {
    if (!mapImage.naturalWidth) return;
    cancelAnimationFrame(animationFrame);
    const width = mapViewport.clientWidth;
    const height = mapViewport.clientHeight;
    const imageWidth = mapImage.naturalWidth;
    const imageHeight = mapImage.naturalHeight;
    // Contain, not cover: the overview must show all four edges of the image.
    // Never stretch the source beyond one image pixel per physical screen pixel.
    const nativeScale = 1 / (window.devicePixelRatio || 1);
    const fit = Math.min(width / imageWidth, height / imageHeight, nativeScale);
    const scale = focusedPlace
        ? Math.max(fit, Math.min(fit * mapSettings.zoom, nativeScale))
        : fit;
    const location = mapLocations[focusedPlace];
    const offset = (size, imageSize, point) => {
        const rendered = imageSize * scale;
        if (!location || rendered <= size) return (size - rendered) / 2;
        return Math.max(
            size - rendered,
            Math.min(0, size / 2 - point * rendered),
        );
    };
    const target = {
        x: offset(width, imageWidth, location?.x),
        y: offset(height, imageHeight, location?.y),
        scale,
    };
    mapCanvas.style.width = `${imageWidth}px`;
    mapCanvas.style.height = `${imageHeight}px`;
    mapCanvas.querySelectorAll("[data-place]").forEach((pin) => {
        const point = mapLocations[pin.dataset.place];
        pin.style.left = `${point.x * 100}%`;
        pin.style.top = `${point.y * 100}%`;
    });
    if (!animate || !camera) {
        paintCamera(target);
        return;
    }
    const start = { ...camera };
    const startedAt = performance.now();
    const frame = (now) => {
        const progress = Math.min(
            1,
            (now - startedAt) / mapSettings.durationMs,
        );
        const ease = progress * progress * (3 - 2 * progress);
        paintCamera({
            x: start.x + (target.x - start.x) * ease,
            y: start.y + (target.y - start.y) * ease,
            scale: start.scale + (target.scale - start.scale) * ease,
        });
        if (progress < 1) animationFrame = requestAnimationFrame(frame);
    };
    animationFrame = requestAnimationFrame(frame);
}
function selectPlace(key) {
    focusedPlace = key;
    document.querySelectorAll("[data-place]").forEach((button) => {
        const selected = button.dataset.place === key;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    const place = places[key || "settlement"];
    document.querySelector("#place-code").textContent = key
        ? place.code
        : "ОБЩИЙ ВИД / ВЫБЕРИ ЛОКАЦИЮ";
    document.querySelector("#place-title").textContent = key
        ? place.title
        : "Куда отправимся?";
    document.querySelector("#place-description").textContent = key
        ? place.text
        : "Нажми на точку 01, 02 или 03, чтобы приблизить карту и осмотреть локацию. Между точками можно переключаться кнопками над картой.";
    resetMap.disabled = !key;
    renderMap(true);
}
document
    .querySelectorAll("[data-place]")
    .forEach((button) =>
        button.addEventListener("click", () =>
            selectPlace(button.dataset.place),
        ),
    );
resetMap.addEventListener("click", () => selectPlace(null));
mapImage.addEventListener("load", () => renderMap());
new ResizeObserver(() => renderMap()).observe(mapViewport);
selectPlace(null);
const info = document.querySelector("#info-dialog");
const copy = {
    intro: {
        title: "Пока тлеет искра.",
        text: "Dead Spark — 2D survival-action для PC и Android. Исследуй снежный постапокалиптический мир, собирай лут, создавай предметы и сражайся. Следи за здоровьем, голодом, жаждой и состоянием экипировки. Играй в одиночку или исследуй общий мир с друзьями в кооперативе.",
    },
    access: {
        title: "Перед первым шагом.",
        text: "Dead Spark разрабатывается для PC и Android. На сайте пока нет опубликованных ссылок на сборки и объявленной даты выхода. Когда разработчик предоставит актуальную версию, здесь можно будет разместить скачивание и инструкции по запуску.",
    },
};
document.querySelectorAll("[data-open]").forEach((button) =>
    button.addEventListener("click", () => {
        const content = copy[button.dataset.open];
        document.querySelector("#dialog-title").textContent = content.title;
        document.querySelector("#dialog-text").textContent = content.text;
        info.showModal();
    }),
);
document
    .querySelector("#expand-map")
    .addEventListener("click", () =>
        document.querySelector("#map-dialog").showModal(),
    );
document.querySelectorAll("dialog").forEach((dialog) => {
    dialog
        .querySelectorAll(".close,.close-action")
        .forEach((button) =>
            button.addEventListener("click", () => dialog.close()),
        );
    dialog.addEventListener("click", (event) => {
        if (dialog.id === "account-dialog") return;
        if (event.target === dialog) {
            const r = dialog.getBoundingClientRect();
            if (
                event.clientX < r.left ||
                event.clientX > r.right ||
                event.clientY < r.top ||
                event.clientY > r.bottom
            )
                dialog.close();
        }
    });
});
