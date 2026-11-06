@echo off
setlocal EnableDelayedExpansion

echo ===============================================================================
echo                PROYECTO PRISMA - SOVEREIGN TEST RUNNER LOCAL
echo ===============================================================================

set FAILURES=0

REM 1. Verificacion Python (Unittest)
echo [1/2] Ejecutando suite de pruebas unitarias Python...
if exist tests (
    python -m unittest discover -s tests -p "test_*.py"
    if errorlevel 1 (
        echo [ERROR] Pruebas unitarias de Python fallaron.
        set /a FAILURES+=1
    ) else (
        echo [OK] Pruebas de Python pasaron exitosamente.
    )
) else (
    echo [SKIP] Directorio tests/ no encontrado aun.
)

REM 2. Verificacion Frontend
echo.
echo [2/2] Verificando sanidad de TypeScript/Frontend...
if exist package.json (
    call npm test --if-present
    if errorlevel 1 (
        echo [ERROR] Pruebas o typecheck de frontend fallaron.
        set /a FAILURES+=1
    ) else (
        echo [OK] Frontend verificado.
    )
) else (
    echo [SKIP] package.json no encontrado aun.
)

echo.
echo ===============================================================================
if !FAILURES! GTR 0 goto :failed

echo RESULTADO: TODAS LAS PRUEBAS PASARON - COSTO CERO
exit /b 0

:failed
echo RESULTADO: FALLO CON !FAILURES! ERRORES.
exit /b 1
