export const compressImage = async (file: File, maxSize: number = 1024): Promise<File> => {
    console.log(`[ImageUtils] Processing file: ${file.name}, Type: ${file.type}, Size: ${file.size}`);

    // 1. Check for HEIC/HEIF
    let processingFile = file;
    const isHeic = file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        file.name.toLowerCase().endsWith('.heic') ||
        file.name.toLowerCase().endsWith('.heif');

    if (isHeic) {
        try {
            console.log("[ImageUtils] Detected HEIC file. Importing converter...");
            // @ts-ignore
            const heic2any = (await import('heic2any')).default;
            console.log("[ImageUtils] heic2any loaded:", heic2any);

            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("HEIC conversion timed out after 10s")), 10000)
            );

            // Race conversion against timeout
            const conversionPromise = heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.9
            });

            // Silence potential unhandled rejection if this promise fails AFTER the timeout wins
            conversionPromise.catch(() => { });

            const convertedBlob = await Promise.race([conversionPromise, timeoutPromise]) as Blob | Blob[];

            console.log("[ImageUtils] Conversion result:", convertedBlob);

            // heic2any can return Blob or Blob[]
            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            processingFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
            });
            console.log("[ImageUtils] HEIC successfully converted to JPEG");
        } catch (err) {
            console.warn("[ImageUtils] Client-side HEIC conversion failed or timed out (falling back):", err);
            // If it timed out or failed, we must throw so the UI stops spinning
            throw new Error("Failed to convert HEIC image: " + (err instanceof Error ? err.message : String(err)));
        }
    } else {
        console.log("[ImageUtils] File is not HEIC, proceeding with standard compression.");
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(processingFile);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], processingFile.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    } else {
                        reject(new Error("Canvas to Blob conversion failed"));
                    }
                }, 'image/jpeg', 0.8);
            };
            img.onerror = (e) => {
                console.error("Image load error:", e);
                reject(new Error("Failed to load image for compression"));
            };
        };
        reader.onerror = (e) => {
            console.error("FileReader error:", e);
            reject(new Error("Failed to read file"));
        };
    });
};
