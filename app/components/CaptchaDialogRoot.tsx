import React, { ElementRef, useEffect, useRef, useState } from "react";
import styles from "./CaptchaDialogRoot.module.scss";

interface CaptchaProps {
  title?: string;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}



export const CaptchaDialogRoot: React.FC<CaptchaProps> = ({
                                                            children,
                                                            title,
                                                            footer,
                                                            open,
                                                            onOpenChange
                                                          }) => {
  const dialogRef = useRef<ElementRef<"dialog"> | ElementRef<"div">>(null);
  const [isDialogSupported, setIsDialogSupported] = useState(true);

  useEffect(() => {
    // 检查浏览器是否支持 dialog 元素
    setIsDialogSupported('show' in document.createElement('dialog'));
  }, []);

  useEffect(() => {
    if (!dialogRef.current) return;

    if (open) {
      if (isDialogSupported) {
        (dialogRef.current as HTMLDialogElement).showModal();
      } else {
        // 回退方案：使用 div 模拟 dialog
        document.body.style.overflow = 'hidden';
        (dialogRef.current as HTMLDivElement).style.display = 'flex';
      }
    } else {
      if (isDialogSupported) {
        (dialogRef.current as HTMLDialogElement).close();
      } else {
        document.body.style.overflow = '';
        (dialogRef.current as HTMLDivElement).style.display = 'none';
      }
    }
  }, [open, isDialogSupported]);

  const DialogComponent = isDialogSupported ? 'dialog' : 'div';

  const content = (
    <DialogComponent
      ref={dialogRef as any}
      className={`${styles["captcha-dialog"]} ${!isDialogSupported ? styles["captcha-dialog-fallback"] : ''}`}
      onClose={() => isDialogSupported && onOpenChange(false)}
    >
      <div className={styles["captcha-dialog-content"]}>
        <div className={styles["captcha-dialog-title"]}>
          {title ?? "验证"}
        </div>
        <div className={styles["captcha-dialog-body"]}>
          {open && children}
        </div>
        <div className={styles["captcha-dialog-footer"]}>
          {footer}
        </div>
      </div>
      <button
        onClick={() => onOpenChange(false)}
        className={styles["captcha-dialog-close"]}
      >
        ×
      </button>
    </DialogComponent>
  );

  return isDialogSupported ? (
    content
  ) : (
    <div className={styles["modal-overlay"]} style={{ display: open ? 'flex' : 'none' }}>
      {content}
    </div>
  );
};