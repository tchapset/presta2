import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

interface GalleryLightboxProps {
  images: string[];
}

const GalleryLightbox = ({ images }: GalleryLightboxProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const close = () => setSelectedIndex(null);
  const prev = () => setSelectedIndex((i) => (i !== null && i > 0 ? i - 1 : images.length - 1));
  const next = () => setSelectedIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : 0));

  return (
    <>
      {/* Grid */}
      <div className={`grid gap-3 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {images.map((url, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedIndex(i)}
            className="relative group overflow-hidden rounded-xl aspect-square bg-muted"
          >
            <img
              src={url}
              alt={`Portfolio ${i + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </motion.button>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-foreground/90 backdrop-blur-sm"
            onClick={close}
          >
            <button
              onClick={(e) => { e.stopPropagation(); close(); }}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-background/20 flex items-center justify-center text-primary-foreground hover:bg-background/40 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prev(); }}
                  className="absolute left-4 z-10 w-10 h-10 rounded-full bg-background/20 flex items-center justify-center text-primary-foreground hover:bg-background/40 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); next(); }}
                  className="absolute right-4 z-10 w-10 h-10 rounded-full bg-background/20 flex items-center justify-center text-primary-foreground hover:bg-background/40 transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            <motion.img
              key={selectedIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={images[selectedIndex]}
              alt=""
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Counter */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-background/20 text-primary-foreground text-sm font-medium">
              {selectedIndex + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GalleryLightbox;
