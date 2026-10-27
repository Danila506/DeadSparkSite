// Loading screen: stays until the page and its images load, at least long enough for a few strides,
// and never longer than MAX_MS so a slow image cannot hold the page hostage.
const preloader = document.querySelector('.preloader');
if (preloader) {
    const MIN_MS = 1100;
    const MAX_MS = 8000;
    let hidden = false;
    const hide = () => {
        if (hidden) return;
        hidden = true;
        preloader.classList.add('is-done');
        setTimeout(() => preloader.remove(), 600);
    };
    const hideAfterMinimum = () => setTimeout(hide, Math.max(0, MIN_MS - performance.now()));
    if (document.readyState === 'complete') hideAfterMinimum();
    else addEventListener('load', hideAfterMinimum, { once: true });
    setTimeout(hide, MAX_MS);
}
