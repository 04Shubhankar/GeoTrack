// ============================================================
// GeoTrack Frontend
// ============================================================

// FastAPI backend
const API = "http://127.0.0.1:8000";


// ============================================================
// CLASS COLORS
// ============================================================

const CLASS_COLORS = {

    urban_land: "#00ffff",

    agriculture_land: "#ffff00",

    rangeland: "#ff00ff",

    forest_land: "#00ff00",

    water: "#0055ff",

    barren_land: "#cccccc"

};


// ============================================================
// STATE
// ============================================================

let selectedFile = null;


// ============================================================
// ELEMENTS
// ============================================================

const fileInput =
    document.getElementById("fileInput");

const uploadBtn =
    document.getElementById("uploadBtn");

const uploadDrop =
    document.getElementById("uploadDrop");

const uploadTrigger =
    document.getElementById("uploadTrigger");

const selectedFileEl =
    document.getElementById("selectedFile");

const statusEl =
    document.getElementById("statusBar");

const resultsEl =
    document.getElementById("results");

const originalImg =
    document.getElementById("originalImg");

const maskImg =
    document.getElementById("maskImg");

const confidenceVal =
    document.getElementById("confidenceVal");

const classCount =
    document.getElementById("classCount");

const classBreakdown =
    document.getElementById("classBreakdown");

const geojsonLink =
    document.getElementById("geojsonLink");


// ============================================================
// FILE SELECTION
// ============================================================

function selectFile(file) {

    if (!file) {
        return;
    }

    selectedFile = file;


    // Display filename
    selectedFileEl.textContent =
        `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;


    // Enable button
    uploadBtn.disabled = true;

    uploadBtn.textContent =
        "Run GeoTrack";
}


// ============================================================
// FILE INPUT
// ============================================================

fileInput.addEventListener("change", function (event) {

    const file =
        event.target.files[0];

    selectFile(file);

});


// ============================================================
// UPLOAD AREA CLICK
// ============================================================

uploadDrop.addEventListener("click", function () {

    fileInput.click();

});


// ============================================================
// BROWSE LINK
// ============================================================

if (uploadTrigger) {

    uploadTrigger.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            fileInput.click();

        }
    );

}


// ============================================================
// DRAG OVER
// ============================================================

uploadDrop.addEventListener(
    "dragover",
    function (event) {

        event.preventDefault();

        uploadDrop.classList.add("dragover");

    }
);


// ============================================================
// DRAG LEAVE
// ============================================================

uploadDrop.addEventListener(
    "dragleave",
    function () {

        uploadDrop.classList.remove("dragover");

    }
);


// ============================================================
// DROP
// ============================================================

uploadDrop.addEventListener(
    "drop",
    function (event) {

        event.preventDefault();

        uploadDrop.classList.remove("dragover");


        const file =
            event.dataTransfer.files[0];

        selectFile(file);

    }
);


// ============================================================
// IMAGE ERROR HANDLING
// ============================================================

originalImg.addEventListener(
    "error",
    function () {

        console.error(
            "Could not load original image:",
            originalImg.src
        );

    }
);


maskImg.addEventListener(
    "error",
    function () {

        console.error(
            "Could not load prediction mask:",
            maskImg.src
        );

    }
);


// ============================================================
// IMAGE LOAD DEBUGGING
// ============================================================

originalImg.addEventListener(
    "load",
    function () {

        console.log(
            "Original image loaded:",
            originalImg.src
        );

    }
);


maskImg.addEventListener(
    "load",
    function () {

        console.log(
            "Prediction mask loaded:",
            maskImg.src
        );

    }
);


// ============================================================
// RUN GEOTRACK
// ============================================================

uploadBtn.addEventListener(
    "click",
    async function () {

        if (!selectedFile) {

            return;

        }


        // ----------------------------------------------------
        // UI: PROCESSING
        // ----------------------------------------------------

        uploadBtn.disabled = true;

        uploadBtn.textContent =
            "Processing...";


        statusEl.className =
            "status-bar loading";

        statusEl.textContent =
            "⏳ Running GeoTrack pipeline — this may take a moment...";


        resultsEl.className =
            "results";


        try {


            // ------------------------------------------------
            // FORM DATA
            // ------------------------------------------------

            const formData =
                new FormData();

            formData.append(
                "file",
                selectedFile
            );


            console.log(
                "Uploading file:",
                selectedFile.name
            );


            // ------------------------------------------------
            // SEND REQUEST
            // ------------------------------------------------

            const response =
                await fetch(
                    `${API}/predict`,
                    {
                        method: "POST",
                        body: formData
                    }
                );


            console.log(
                "Server status:",
                response.status
            );


            // ------------------------------------------------
            // GET JSON
            // ------------------------------------------------

            const data =
                await response.json();


            console.log(
                "Prediction response:",
                data
            );


            // ------------------------------------------------
            // SERVER ERROR
            // ------------------------------------------------

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    `Server error: ${response.status}`
                );

            }


            if (data.error) {

                throw new Error(
                    data.error
                );

            }


            // =================================================
            // IMAGE URLS
            // =================================================

            const timestamp =
                Date.now();


            const originalURL =
                `${API}${data.original_url}?t=${timestamp}`;


            const maskURL =
                `${API}${data.mask_url}?t=${timestamp}`;


            console.log(
                "Original URL:",
                originalURL
            );


            console.log(
                "Mask URL:",
                maskURL
            );


            // =================================================
            // DISPLAY ORIGINAL IMAGE
            // =================================================

            originalImg.src =
                originalURL;


            // =================================================
            // DISPLAY PREDICTED MASK
            // =================================================

            maskImg.src =
                maskURL;


            // =================================================
            // CONFIDENCE
            // =================================================

            if (
                data.confidence !== undefined &&
                data.confidence !== null
            ) {

                const confidence =
                    Number(data.confidence);


                if (!Number.isNaN(confidence)) {

                    confidenceVal.textContent =
                        `${(confidence * 100).toFixed(1)}%`;

                }

            }


            // =================================================
            // CLASS BREAKDOWN
            // =================================================

            const breakdown =
                data.class_breakdown || {};


            classCount.textContent =
                Object.keys(breakdown).length;


            classBreakdown.innerHTML =
                "";


            for (
                const [className, percentage]
                of Object.entries(breakdown)
            ) {


                const color =
                    CLASS_COLORS[className] ||
                    "#888888";


                const label =
                    className.replace(
                        /_/g,
                        " "
                    );


                const pct =
                    Number(percentage) || 0;


                classBreakdown.innerHTML += `

                    <div class="class-row">

                        <div
                            class="class-swatch"
                            style="background:${color}">
                        </div>

                        <div class="class-name">
                            ${label}
                        </div>

                        <div class="bar-track">

                            <div
                                class="bar-fill"
                                style="
                                    width:${pct}%;
                                    background:${color};
                                ">
                            </div>

                        </div>

                        <div class="class-pct">
                            ${pct.toFixed(1)}%
                        </div>

                    </div>

                `;

            }


            // =================================================
            // GEOJSON DOWNLOAD
            // =================================================

            if (data.geojson_url) {

                geojsonLink.href =
                    `${API}${data.geojson_url}`;

            }


            // =================================================
            // SHOW RESULTS
            // =================================================

            resultsEl.className =
                "results visible";


            statusEl.className =
                "status-bar";


            statusEl.textContent =
                "";


            // =================================================
            // RESET BUTTON
            // =================================================

            uploadBtn.disabled =
                false;

            uploadBtn.textContent =
                "Run GeoTrack";


            // =================================================
            // SCROLL TO RESULTS
            // =================================================

            resultsEl.scrollIntoView({

                behavior: "smooth",

                block: "start"

            });


        } catch (error) {


            // =================================================
            // ERROR
            // =================================================

            console.error(
                "GeoTrack error:",
                error
            );


            statusEl.className =
                "status-bar error";


            statusEl.textContent =
                `❌ ${error.message}`;


            uploadBtn.disabled =
                false;


            uploadBtn.textContent =
                "Run GeoTrack";

        }

    }
);