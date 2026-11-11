import { useRef, useState } from 'react';
import { ORG } from '../config/org';

const KEY = 'hr-dashboard:logo';

/**
 * לוגו העמותה בפינה הימנית העליונה.
 * סדר עדיפויות: לוגו שהועלה בממשק (נשמר בדפדפן) → public/logo.png → שם העמותה כטקסט.
 * לחיצה על הלוגו מאפשרת להעלות/להחליף תמונה.
 */
export function Logo() {
  const [custom, setCustom] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });
  const [fileOk, setFileOk] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const src = custom ?? (fileOk ? `${import.meta.env.BASE_URL}logo.png` : null);

  function onFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setCustom(url);
      try {
        localStorage.setItem(KEY, url);
      } catch {
        /* גדול מדי או חסום — יוצג רק בסשן הנוכחי */
      }
    };
    reader.readAsDataURL(f);
  }

  return (
    <button className="logo" type="button" title="לחצו להעלאת / החלפת לוגו" onClick={() => input.current?.click()}>
      {src ? (
        <img
          src={src}
          alt={ORG.name}
          onError={() => (custom ? setCustom(null) : setFileOk(false))}
        />
      ) : (
        <span className="logo-text">{ORG.name}</span>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </button>
  );
}
