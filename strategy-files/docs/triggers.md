# Triggers
___

Class for create tasks triggered by price or time.

* **Methods**
  - [subscribe](#subscribe)
  - [addTaskByPrice](#addTaskByPrice)
  - [addTaskByTime](#addTaskByTime)
  - [clearAllTask](#clearAllTask)

<br>

## [subscribe](#subscribe)

Subscribe to task. Callback will be called when task triggered.

```typescript
subscribe(taskName: string, callback: (...args: unknown[]) => void): void
```

* **Parameters**
    - `taskName`: \<_string_> - Name of task.
    - `callback`: \<_Function_> - Callback function.


* **Returns:** _void_.

___

<br>

## [addTaskByPrice](#addTaskByPrice)

Task will be triggered when price cross `triggerPrice` from down to up or from up to down.

```typescript
addTaskByPrice(price: number, taskName: string, params: Record<string, unknown>): string
```

* **Parameters**
    - `price`: \<_number_> - Price for trigger.
    - `taskName`: \<_string_> - Name of task.
    - `params`: \<_Record<string, unknown>_> - Params will be passed to callback.


* **Returns:** _string_ - Trigger id.

___

<br>

## [addTaskByTime](#addTaskByTime)

Task will be triggered when the time is reached.

```typescript
addTaskByTime(time: number, taskName: string, params: Record<string, unknown>): string
```

* **Parameters**
    - `time`: \<_number_> - Time in milliseconds.
    - `taskName`: \<_string_> - Name of task.
    - `params`: \<_Record<string, unknown>_> - Params will be passed to callback.


* **Returns:** _string_ - Trigger id.

___

<br>

## [clearAllTask](#clearAllTask)

Clear all tasks.

```typescript
clearAllTask(): void
```

* **Returns:** _void_.

___

<br>
