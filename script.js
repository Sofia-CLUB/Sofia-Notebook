const canvas =
    document.getElementById("drawingCanvas");

const notebook =
    document.getElementById("notebook");

const ctx =
    canvas.getContext("2d");

const textLayer =
    document.getElementById("textLayer");

const drawBtn =
    document.getElementById("drawBtn");

const eraserBtn =
    document.getElementById("eraserBtn");

const textBtn =
    document.getElementById("textBtn");

const clearBtn =
    document.getElementById("clearBtn");

const saveBtn =
    document.getElementById("saveBtn");

const undoBtn =
    document.getElementById("undoBtn");

const colorPicker =
    document.getElementById("colorPicker");

const lineWidth =
    document.getElementById("lineWidth");

const studentName =
    document.getElementById("studentName");

const studentClass =
    document.getElementById("studentClass");

const subject =
    document.getElementById("subject");

const workType =
    document.getElementById("workType");

const displaySubject =
    document.getElementById("displaySubject");

const saveStatus =
    document.getElementById("saveStatus");



let drawing = false;

let mode = "draw";

let history = [];



/* -----------------------
   ДАТА
----------------------- */

const today =
    new Date();

const dateFormatter =
    new Intl.DateTimeFormat(
        "uk-UA",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

document.getElementById(
    "currentDate"
).textContent =
    dateFormatter.format(today);



/* -----------------------
   CANVAS
----------------------- */

function resizeCanvas() {

    const savedImage =
        canvas.toDataURL();

    canvas.width =
        notebook.clientWidth;

    canvas.height =
        notebook.clientHeight;

    const img =
        new Image();

    img.onload = function () {

        ctx.drawImage(
            img,
            0,
            0
        );
    };

    img.src =
        savedImage;
}


resizeCanvas();

window.addEventListener(
    "resize",
    resizeCanvas
);



/* -----------------------
   КООРДИНАТИ
----------------------- */

function getPosition(event) {

    const rect =
        canvas.getBoundingClientRect();

    let clientX;
    let clientY;

    if (event.touches) {

        clientX =
            event.touches[0].clientX;

        clientY =
            event.touches[0].clientY;

    } else {

        clientX =
            event.clientX;

        clientY =
            event.clientY;
    }

    return {

        x:
            clientX -
            rect.left,

        y:
            clientY -
            rect.top
    };
}



/* -----------------------
   ПОЧАТОК МАЛЮВАННЯ
----------------------- */

function startDrawing(event) {

    if (mode === "text") {
        return;
    }

    event.preventDefault();

    drawing = true;

    saveHistory();

    const pos =
        getPosition(event);

    ctx.beginPath();

    ctx.moveTo(
        pos.x,
        pos.y
    );
}



/* -----------------------
   МАЛЮВАННЯ
----------------------- */

function draw(event) {

    if (!drawing) {
        return;
    }

    event.preventDefault();

    const pos =
        getPosition(event);


    if (mode === "eraser") {

        ctx.globalCompositeOperation =
            "destination-out";

        ctx.lineWidth =
            25;

    } else {

        ctx.globalCompositeOperation =
            "source-over";

        ctx.strokeStyle =
            colorPicker.value;

        ctx.lineWidth =
            Number(
                lineWidth.value
            );
    }


    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";


    ctx.lineTo(
        pos.x,
        pos.y
    );

    ctx.stroke();
}



/* -----------------------
   КІНЕЦЬ МАЛЮВАННЯ
----------------------- */

function stopDrawing() {

    if (!drawing) {
        return;
    }

    drawing = false;

    ctx.closePath();
}



/* MOUSE */

canvas.addEventListener(
    "mousedown",
    startDrawing
);

canvas.addEventListener(
    "mousemove",
    draw
);

canvas.addEventListener(
    "mouseup",
    stopDrawing
);

canvas.addEventListener(
    "mouseleave",
    stopDrawing
);



/* TOUCH */

canvas.addEventListener(
    "touchstart",
    startDrawing
);

canvas.addEventListener(
    "touchmove",
    draw
);

canvas.addEventListener(
    "touchend",
    stopDrawing
);



/* -----------------------
   РЕЖИМИ
----------------------- */

function removeActiveTools() {

    drawBtn.classList.remove(
        "active"
    );

    eraserBtn.classList.remove(
        "active"
    );

    textBtn.classList.remove(
        "active"
    );
}



drawBtn.addEventListener(
    "click",
    function () {

        mode = "draw";

        removeActiveTools();

        drawBtn.classList.add(
            "active"
        );

        canvas.style.pointerEvents =
            "auto";

        textLayer.classList.remove(
            "active"
        );

        textLayer.contentEditable =
            false;
    }
);



eraserBtn.addEventListener(
    "click",
    function () {

        mode = "eraser";

        removeActiveTools();

        eraserBtn.classList.add(
            "active"
        );

        canvas.style.pointerEvents =
            "auto";

        textLayer.classList.remove(
            "active"
        );

        textLayer.contentEditable =
            false;
    }
);



textBtn.addEventListener(
    "click",
    function () {

        mode = "text";

        removeActiveTools();

        textBtn.classList.add(
            "active"
        );

        canvas.style.pointerEvents =
            "none";

        textLayer.classList.add(
            "active"
        );

        textLayer.contentEditable =
            true;

        textLayer.focus();
    }
);



/* -----------------------
   ФОНИ
----------------------- */

const backgroundButtons =
    document.querySelectorAll(
        ".background-btn"
    );


backgroundButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            function () {

                backgroundButtons.forEach(
                    item =>
                        item.classList.remove(
                            "active"
                        )
                );

                button.classList.add(
                    "active"
                );


                notebook.classList.remove(
                    "grid-background",
                    "lines-background",
                    "clean-background"
                );


                const background =
                    button.dataset.background;


                if (
                    background === "grid"
                ) {

                    notebook.classList.add(
                        "grid-background"
                    );

                }


                if (
                    background === "lines"
                ) {

                    notebook.classList.add(
                        "lines-background"
                    );

                }


                if (
                    background === "clean"
                ) {

                    notebook.classList.add(
                        "clean-background"
                    );

                }

            }
        );

    }
);



/* -----------------------
   HISTORY / UNDO
----------------------- */

function saveHistory() {

    history.push(
        canvas.toDataURL()
    );


    if (
        history.length > 30
    ) {

        history.shift();
    }
}



undoBtn.addEventListener(
    "click",
    function () {

        if (
            history.length === 0
        ) {

            return;
        }


        const previous =
            history.pop();


        const image =
            new Image();


        image.onload =
            function () {

                ctx.clearRect(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );


                ctx.drawImage(
                    image,
                    0,
                    0
                );
            };


        image.src =
            previous;
    }
);



/* -----------------------
   ОЧИЩЕННЯ
----------------------- */

clearBtn.addEventListener(
    "click",
    function () {

        const confirmed =
            confirm(
                "Очистити весь зошит?"
            );


        if (!confirmed) {
            return;
        }


        saveHistory();


        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        textLayer.innerHTML =
            "";


        saveStatus.textContent =
            "Зошит очищено";
    }
);



/* -----------------------
   НАЗВА ПРЕДМЕТА
----------------------- */

subject.addEventListener(
    "change",
    updateNotebookTitle
);

workType.addEventListener(
    "change",
    updateNotebookTitle
);


function updateNotebookTitle() {

    let title = "";

    if (subject.value) {

        title +=
            subject.value;

    } else {

        title +=
            "Мій зошит";
    }


    if (workType.value) {

        title +=
            " • " +
            workType.value;
    }


    displaySubject.textContent =
        title;
}



/* -----------------------
   ЗБЕРЕЖЕННЯ
----------------------- */

function saveNotebook() {

    const selectedBackground =
        document.querySelector(
            ".background-btn.active"
        );


    const notebookData = {

        studentName:
            studentName.value,

        studentClass:
            studentClass.value,

        subject:
            subject.value,

        workType:
            workType.value,

        background:
            selectedBackground
                ?.dataset
                .background ||
            "grid",

        drawing:
            canvas.toDataURL(),

        text:
            textLayer.innerHTML,

        savedAt:
            new Date()
                .toISOString()
    };


    localStorage.setItem(
        "sofiaNotebook",
        JSON.stringify(
            notebookData
        )
    );


    saveStatus.textContent =
        "✅ Збережено " +
        new Date()
            .toLocaleTimeString(
                "uk-UA",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );
}



saveBtn.addEventListener(
    "click",
    saveNotebook
);



/* -----------------------
   АВТОЗБЕРЕЖЕННЯ
----------------------- */

setInterval(
    function () {

        saveNotebook();

    },
    30000
);



/* -----------------------
   ЗАВАНТАЖЕННЯ
----------------------- */

function loadNotebook() {

    const saved =
        localStorage.getItem(
            "sofiaNotebook"
        );


    if (!saved) {
        return;
    }


    const data =
        JSON.parse(saved);


    studentName.value =
        data.studentName || "";

    studentClass.value =
        data.studentClass || "";

    subject.value =
        data.subject || "";

    workType.value =
        data.workType ||
        "Класна робота";


    textLayer.innerHTML =
        data.text || "";


    /* ФОН */

    backgroundButtons.forEach(
        item =>
            item.classList.remove(
                "active"
            )
    );


    const backgroundButton =
        document.querySelector(
            `[data-background="${data.background}"]`
        );


    if (backgroundButton) {

        backgroundButton.classList.add(
            "active"
        );
    }


    notebook.classList.remove(
        "grid-background",
        "lines-background",
        "clean-background"
    );


    if (
        data.background === "lines"
    ) {

        notebook.classList.add(
            "lines-background"
        );

    } else if (
        data.background === "clean"
    ) {

        notebook.classList.add(
            "clean-background"
        );

    } else {

        notebook.classList.add(
            "grid-background"
        );
    }


    /* МАЛЮНОК */

    if (
        data.drawing
    ) {

        const image =
            new Image();


        image.onload =
            function () {

                ctx.drawImage(
                    image,
                    0,
                    0
                );
            };


        image.src =
            data.drawing;
    }


    updateNotebookTitle();


    saveStatus.textContent =
        "Відновлено останню збережену роботу";
}



setTimeout(
    loadNotebook,
    200
);
