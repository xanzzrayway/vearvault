# <DOCTYPE HTML>
# <pristel>Emot dulu</pristel>

import tkinter as tk
from tkinter import ttk
import threading
import time

class TimerProgressApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Progress Bar Timer")
        self.geometry("300x150")
        self.resizable(False, False)

        # style
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure("TProgressbar", thickness=20, foreground="#4caf50", background="#a5d6a7")

        # entry waktu
        self.time_var = tk.StringVar(value="5")
        ttk.Label(self, text="Detik:").pack(pady=(10,0))
        ttk.Entry(self, textvariable=self.time_var, width=10, justify='center').pack()

        # progress bar
        self.progress = ttk.Progressbar(self, orient="horizontal", length=250, mode="determinate")
        self.progress.pack(pady=10)

        # control button
        self.btn_text = tk.StringVar(value="Start")
        self.control_btn = ttk.Button(self, textvariable=self.btn_text, command=self.toggle)
        self.control_btn.pack()

        self.running = False
        self.thread = None

    def toggle(self):
        if not self.running:
            # start
            try:
                self.total_seconds = int(self.time_var.get())
                if self.total_seconds <= 0: raise ValueError
            except ValueError:
                tk.messagebox.showerror("Error", "Masukin angka >0")
                return
            self.progress["maximum"] = self.total_seconds
            self.progress["value"] = 0
 self.running = True
            self.btn_text.set("Stop")
            self.thread = threading.Thread(target=self.run_timer, daemon=True)
            self.thread.start()
        else:
            # stop
            self.running = False
            self.btn_text.set("Start")

    def run_timer(self):
        start = time.time()
        while self.running and self.progress["value"] < self.total_seconds:
            elapsed = time.time() - start
            self.progress["value"] = elapsed
            time.sleep(0.05)
        self.running = False
        self.btn_text.set("Start")

if __name__ == "__main__":
    app = TimerProgressApp()
    app.mainloop()
