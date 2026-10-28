# Importar tareas desde texto

`POST /v1/calendar/tasks/parse-text` recibe un Bearer token y `{ "date": "YYYY-MM-DD", "text": "..." }`. Analiza el texto con el modelo definido en `OPENAI_MODEL`, almacena en `calendar_tasks` las tareas con fecha y hora, y guarda en `pending_calendar_tasks` las que requieren asignación manual. Si hay fecha y hora inicial, pero no hora final, asigna una hora de duración. Después de guardar, devuelve el estado actualizado de esa fecha junto con las tareas pendientes.

`GET /v1/calendar/tasks?date=YYYY-MM-DD` y `POST /v1/calendar/tasks/parse-text` devuelven el mismo formato: `date`, `timezone`, `tasks` y `tasksWithoutSchedule`. Las tareas pendientes también se pueden consultar con `GET /v1/calendar/pending-tasks`. Para asignar horario, enviar `POST /v1/calendar/pending-tasks/:id/schedule` con `startsAt` y `endsAt` en formato ISO 8601 con zona horaria. La operación mueve la tarea al calendario en una transacción.

También se puede asignar una tarea pendiente con `PATCH /v1/calendar/tasks/:id` enviando `startsAt` y `endsAt`; responde con el estado actualizado del día en el mismo formato que `GET /v1/calendar/tasks?date=...`.

```bash
curl -X POST http://localhost:9080/v1/calendar/tasks/parse-text \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-10-29","text":"Mañana a las 9 revisar presupuesto. También debo llamar al proveedor, pero todavía no sé cuándo."}'
```

Ejecuta la sentencia `CREATE TABLE pending_calendar_tasks` de `docs/claridad-auth-mysql.sql` si la base ya tiene el esquema anterior.
