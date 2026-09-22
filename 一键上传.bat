@echo off
setlocal enabledelayedexpansion
title 漫剧管理 - 一键上传工具
cd /d "%~dp0"

echo ======================================
echo     漫剧文件管理 - 一键上传工具
echo ======================================
echo.

echo [1/3] 正在扫描改动 (git add .)...
git add .
if %errorlevel% neq 0 (
    echo.
    echo [? 失败] 扫描文件时出错！请检查 Git 是否正常。
    echo.
    pause
    exit /b
)
echo [? 成功] 扫描完成。
echo.

echo [2/3] 正在提交到本地仓库 (git commit)...
set /p commit_msg="?? 请输入更新说明 (直接回车自动生成时间戳): "

if "!commit_msg!"=="" (
    echo.
    echo [提示] 未输入说明，正在生成时间戳...
    for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmm"') do set "datetime=%%i"
    if "!datetime!"=="" (
        set "commit_msg=fallback_update"
    ) else (
        set "commit_msg=auto_update_!datetime!"
    )
    echo [? 成功] 自动生成: !commit_msg!
) else (
    echo.
    echo [? 成功] 你输入了: !commit_msg!
)

REM 注意：为了防止 Git 在 CMD 里处理中文时乱码，commit 信息最好用英文或拼音
git commit -m "!commit_msg!"
echo.

echo [3/3] 正在上传到 GitHub (git push)...
git push
if %errorlevel% neq 0 (
    echo.
    echo [? 失败] 上传失败！请检查网络，或者把上面红字发给我看看。
) else (
    echo.
    echo [? 成功] 代码已成功同步到 GitHub！
)
echo.
echo ======================================
echo    全部操作执行完毕
echo ======================================
pause