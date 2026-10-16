// The OS handles the link. A browser cannot reliably confirm that the launcher opened.
const connect = document.querySelector('#connect-nsk-1');
const feedback = document.querySelector('#connection-feedback');
connect.addEventListener('click', () => {
    feedback.hidden = false;
    feedback.textContent = 'Разрешите браузеру открыть Dead Spark Launcher. Если окно не появилось, установите лаунчер и запустите его один раз, затем повторите подключение.';
});
