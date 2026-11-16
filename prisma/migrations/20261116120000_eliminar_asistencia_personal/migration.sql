-- Elimina los horarios y registros de fichado del personal.
BEGIN;

DROP TABLE public."AsistenciaUsuario";
DROP TABLE public."HorarioUsuario";

COMMIT;
