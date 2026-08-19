@echo off
rem Convenience wrapper: `python`/`python3` may not be on PATH (Windows Store
rem alias stubs shadow them), but the `py` launcher reliably finds the real
rem interpreter. Run `run.bat` instead of `python main.py`.
py "%~dp0main.py" %*
