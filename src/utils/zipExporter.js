import JSZip from 'jszip';
import confetti from 'canvas-confetti';

export const triggerConfetti = () => {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 }
    });
  } catch (e) {
    // Graceful fallback if confetti unavailable
  }
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadAsZip = async (items, zipName = 'iloveimg_bundle.zip') => {
  const zip = new JSZip();

  items.forEach((item, index) => {
    const filename = item.fileName || `image_${index + 1}.png`;
    zip.file(filename, item.blob);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, zipName);
  triggerConfetti();
};
