@echo off
chcp 65001 > nul
cd /d "%~dp0"
title 去痕迹 / push 前体检

echo ======================================
echo    去痕迹 / push 前体检
echo ======================================
echo.
echo 作用：把要推到公开仓库的文本里属于个人痕迹的东西清掉
echo   · 需求方的原话引用、"用户实测/用户要求"这类表述 -^> 中性说法
echo   · 示例里的作品名 -^> 占位符
echo   · 不动正常说法（"用户目录""等用户决定"），也不动面向使用者的"你"
echo.
echo 先看要改什么（不落盘）：
echo.
node scrub.js
echo.
echo --------------------------------------
set /p go="要现在清理吗？(y = 清理 / 其他键 = 退出) "
if /i not "%go%"=="y" goto end
echo.
node scrub.js --fix
echo.
echo 清理完了。提交前记得：
echo   1. node map.js        （刷新行号索引）
echo   2. git add -A ^&^& git commit -m "..." ^&^& git push
echo.
:end
pause
