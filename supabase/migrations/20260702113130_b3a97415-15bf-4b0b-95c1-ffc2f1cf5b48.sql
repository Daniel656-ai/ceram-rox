-- Fix: Doppelte Überladung von book_container_consumption entfernen.
-- Die alte 7-Argument-Variante (ohne _allocations) und die neue 8-Argument-Variante
-- (mit _allocations DEFAULT NULL) führten bei RPC-Aufrufen zu
-- "function is not unique" - dadurch konnten keine Verbrauchsbuchungen mehr
-- gespeichert werden. Wir behalten ausschließlich die neue Variante,
-- die sowohl automatische FIFO-Aufteilung als auch optionale manuelle
-- LOT-Zuteilungen unterstützt.
DROP FUNCTION IF EXISTS public.book_container_consumption(
  uuid, numeric, date, text, text, uuid, uuid
);