document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialization
    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
    document.getElementById('current-date').textContent = formattedDate;

    // 0. Mobile Scaling Logic
    const formElement = document.getElementById('application-form');
    let currentScale = 1;

    function applyMobileScale() {
        const containerWidth = window.innerWidth - 20; // 10px padding each side
        const paperWidth = formElement.offsetWidth; // Should be around 794px (210mm)

        if (containerWidth < paperWidth) {
            currentScale = containerWidth / paperWidth;
            formElement.style.transform = `scale(${currentScale})`;
            // Adjust container height because scale doesn't affect flow layout height
            formElement.style.marginBottom = `-${(formElement.offsetHeight * (1 - currentScale))}px`;
        } else {
            currentScale = 1;
            formElement.style.transform = 'none';
            formElement.style.marginBottom = '0';
        }
    }

    window.addEventListener('resize', () => {
        applyMobileScale();
        resizeCanvas();
    });
    // Call once on load
    applyMobileScale();

    // 2. Signature Pad Logic
    const canvas = document.getElementById('signature-pad');
    const ctx = canvas.getContext('2d');
    const clearBtn = document.getElementById('clear-sign');
    // Overlay removed
    let isDrawing = false;

    // Handle high-DPI screens + Mobile Scale
    function resizeCanvas() {
        // We want the canvas internal resolution to match the visual size * pixel ratio
        // But since we are scaling with CSS transform, the 'offsetWidth' is the unscaled size.
        // We should just use standard DPI handling. The CSS transform handles visual shrinking.

        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        ctx.scale(ratio, ratio);
    }

    // Initial resize and listener
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function startDrawing(e) {
        isDrawing = true;
        draw(e);
    }

    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath();
    }

    function draw(e) {
        if (!isDrawing) return;

        // Get coordinates correctly for both mouse and touch
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.type.includes('touch')) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Calculate x, y relative to canvas
        // getBoundingClientRect returns the SCALED size and position.
        // So (clientX - rect.left) gives distance in SCALED pixels.
        // We need to map this back to the canvas internal width (which corresponds to unscaled offsetWidth).
        // Therefore, we divide by the scale factor that represents (rect.width / canvas.offsetWidth).

        const scaleX = rect.width / canvas.offsetWidth;
        const scaleY = rect.height / canvas.offsetHeight;

        const x = (clientX - rect.left) / scaleX;
        const y = (clientY - rect.top) / scaleY;

        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000';

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    // Mouse Events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('mousemove', draw);

    // Touch Events (passive: false is important for preventDefault if used, but here strict drawing)
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Stop scrolling
        startDrawing(e);
    }, { passive: false });

    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Stop scrolling
        draw(e);
    }, { passive: false });

    // Clear Button
    clearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1)); // Clear logic adjustment
        // Reset context scale is tricky, simpler to just wipe fast:
        canvas.width = canvas.width;
        resizeCanvas();
        document.getElementById('name').focus(); // accessibility hook
    });

    // 3. Mirror Name Input to Signature Line
    const nameInput = document.getElementById('name');
    const signerName = document.getElementById('signer-name');
    nameInput.addEventListener('input', (e) => {
        signerName.value = e.target.value;
    });

    // 4. Submission Logic
    const submitBtn = document.getElementById('btn-submit');
    const modal = document.getElementById('success-modal');
    const downloadPdfBtn = document.getElementById('btn-download-pdf');
    const closeModalBtn = document.getElementById('btn-close-modal');

    submitBtn.addEventListener('click', () => {
        // Validation
        const name = document.getElementById('name').value;
        const affiliation = document.getElementById('affiliation').value;
        const privacyAgree = document.getElementById('privacy-agree').checked;

        // Simple check if canvas is empty (basic heuristic: no logic here, assuming user signs)
        // ideally check if canvas is blank, but let's assume valid for now to keep it simple or check pixel data

        if (!name || !affiliation) {
            alert('모든 필수 항목을 입력해주세요 (성명, 소속).');
            return;
        }

        if (!privacyAgree) {
            alert('개인정보 수집 및 이용에 동의해야 합니다.');
            return;
        }

        // Save Data (Mock Backend)
        const submission = {
            id: Date.now(),
            name,
            affiliation,
            // DOB removed
            date: formattedDate,
            signatureData: canvas.toDataURL() // Save signature as Base64
        };

        const submissions = JSON.parse(localStorage.getItem('council_submissions') || '[]');
        submissions.push(submission);
        localStorage.setItem('council_submissions', JSON.stringify(submissions));

        // Show Success Modal
        modal.classList.add('visible');
    });

    // 5. PDF Generation Logic
    downloadPdfBtn.addEventListener('click', async () => {
        const element = document.getElementById('application-form');
        const originalShadow = element.style.boxShadow;
        element.style.boxShadow = 'none'; // Remove shadow for PDF

        // Temporarily hide the signature clear button for clean PDF
        clearBtn.style.display = 'none';

        try {
            const canvasRender = await html2canvas(element, {
                scale: 2, // Higher quality
                useCORS: true,
                logging: false
            });

            const imgData = canvasRender.toDataURL('image/png');
            const { jsPDF } = window.jspdf;

            // Standard A4: 210mm x 297mm
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${nameInput.value}_선거관리위원_지원서.pdf`);

            // User requested message after clicking allow/save
            setTimeout(() => {
                alert("저장이 완료되었습니다.");
            }, 500); // Slight delay to ensure download starts first

        } catch (err) {
            console.error('PDF Generation Error:', err);
            alert('PDF 생성 중 오류가 발생했습니다.');
        } finally {
            element.style.boxShadow = originalShadow;
            clearBtn.style.display = ''; // Restore button
        }
    });

    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('visible');
        // Optional: Reset form
        window.location.reload();
    });
});
