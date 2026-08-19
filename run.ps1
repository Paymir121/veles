# Convenience wrapper: `python`/`python3` may not be on PATH (Windows Store
# alias stubs shadow them), but the `py` launcher reliably finds the real
# interpreter. Run `.\run.ps1` instead of `python main.py`.
py "$PSScriptRoot\main.py" @args
