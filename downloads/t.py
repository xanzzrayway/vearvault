import sys
import time
from datetime import datetime

# Cek apakah library yang dibutuhin udah terinstall
try:
    import psutil
    from rich.console import Console
    from rich.layout import Layout
    from rich.live import Live
    from rich.panel import Panel
    from rich.progress import BarColumn, Progress, TaskProgressColumn, TextColumn
    from rich.table import Table
except ImportError:
    print("Ada library yang kurang nih, BidzQwerty. Jalanin perintah ini dulu di terminal:")
    print("pip install psutil rich")
    sys.exit(1)

console = Console()

class OxySystemMonitor:
    def __init__(self):
        self.layout = Layout()
        self._setup_layout()

    def _setup_layout(self):
        # Bikin struktur grid layout terminal
        self.layout.split(
            Layout(name="header", size=3),
            Layout(name="body", ratio=1),
            Layout(name="footer", size=3)
        )
        self.layout["body"].split_row(
            Layout(name="cpu_ram", ratio=1),
            Layout(name="disk_net", ratio=1)
        )

    def get_header(self) -> Panel:
        # Bikin panel header atas
        grid = Table.grid(expand=True)
        grid.add_column(justify="left", ratio=1)
        grid.add_column(justify="right", ratio=1)
        grid.add_row(
            "[bold cyan]OXY SYSTEM MONITOR[/bold cyan] v1.0",
            f"[bold yellow]{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/bold yellow]"
        )
        return Panel(grid, style="blue")

    def get_cpu_ram(self) -> Panel:
        # Bagian monitoring CPU per core
        cpu_progress = Progress(
            TextColumn("[bold cyan]Core {task.description}[/bold cyan]"),
            BarColumn(bar_width=18, complete_style="green", finished_style="green"),
            TaskProgressColumn()
        )
        
        cpu_percents = psutil.cpu_percent(percpu=True)
        for i, pct in enumerate(cpu_percents):
            cpu_progress.add_task(f"{i}", total=100, completed=pct)

        # Bagian monitoring RAM
        ram = psutil.virtual_memory()
        ram_table = Table.grid(padding=1)
        ram_table.add_row("[bold]Total RAM:[/bold]", f"{ram.total / (1024**3):.2f} GB")
        ram_table.add_row("[bold]Used RAM:[/bold]", f"[red]{ram.used / (1024**3):.2f} GB ({ram.percent}%)[/red]")
        ram_table.add_row("[bold]Free RAM:[/bold]", f"[green]{ram.available / (1024**3):.2f} GB[/green]")

        # Gabungin visual CPU ama RAM
        outer_table = Table.grid(expand=True)
        outer_table.add_row("[bold magenta]=== CPU Usage per Core ===[/bold magenta]")
        outer_table.add_row(cpu_progress)
        outer_table.add_row("\n[bold magenta]=== RAM Status ===[/bold magenta]")
        outer_table.add_row(ram_table)

        return Panel(outer_table, title="[bold green]CPU & Memory[/bold green]", border_style="green")

    def get_disk_net(self) -> Panel:
        # Bagian monitoring Storage
        disk = psutil.disk_usage('/')
        disk_table = Table.grid(padding=1)
        disk_table.add_row("[bold]Total Space:[/bold]", f"{disk.total / (1024**3):.2f} GB")
        disk_table.add_row("[bold]Used Space:[/bold]", f"[red]{disk.used / (1024**3):.2f} GB ({disk.percent}%)[/red]")
        disk_table.add_row("[bold]Free Space:[/bold]", f"[green]{disk.free / (1024**3):.2f} GB[/green]")

        # Bagian monitoring Network I/O
        net = psutil.net_io_counters()
        net_table = Table.grid(padding=1)
        net_table.add_row("[bold]Total Sent:[/bold]", f"[yellow]{net.bytes_sent / (1024**2):.2f} MB[/yellow]")
        net_table.add_row("[bold]Total Recv:[/bold]", f"[blue]{net.bytes_recv / (1024**2):.2f} MB[/blue]")

        # Gabungin visual Disk ama Net
        outer_table = Table.grid(expand=True)
        outer_table.add_row("[bold magenta]=== Disk Usage (Root) ===[/bold magenta]")
        outer_table.add_row(disk_table)
        outer_table.add_row("\n[bold magenta]=== Network Activity ===[/bold magenta]")
        outer_table.add_row(net_table)

        return Panel(outer_table, title="[bold cyan]Disk & Network[/bold cyan]", border_style="cyan")

    def get_footer(self) -> Panel:
        return Panel("[bold white]Tekan Ctrl+C buat keluar | Created by Oxy AI[/bold white]", style="red", justify="center")

    def update_dashboard(self) -> Layout:
        self.layout["header"].update(self.get_header())
        self.layout["cpu_ram"].update(self.get_cpu_ram())
        self.layout["disk_net"].update(self.get_disk_net())
        self.layout["footer"].update(self.get_footer())
        return self.layout

def main():
    monitor = OxySystemMonitor()
    console.print("[bold yellow]Nyiapin dashboard...[/bold yellow]")
    time.sleep(1)
    
    try:
        # Loop live update layar tiap 1 detik
        with Live(monitor.update_dashboard(), refresh_per_second=1, screen=True) as live:
            while True:
                time.sleep(1)
                live.update(monitor.update_dashboard())
    except KeyboardInterrupt:
        console.print("\n[bold red]Dashboard ditutup. Sampai jumpa, BidzQwerty![/bold red]")

if __name__ == "__main__":
    main()