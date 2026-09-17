/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, { useEffect, useMemo, useRef, useState } from 'react';
// import { UserWarning } from './UserWarning';
import {
  deleteTodo,
  getTodos,
  postTodo,
  updateTodo,
  USER_ID,
} from './api/todos';
import { Todo as TodoType } from './types/Todo';
import cn from 'classnames';
import { Filter } from './Components/Filter/Filter';
import { DefaultFilter } from './types/DefaultFilter';
import { TodoList } from './Components/TodoList/TodoList';
import { NewTodo } from './Components/NewTodo.tsx/NewTodo';
import { UserWarning } from './UserWarning';
import { Todo } from './Components/Todo/Todo';

const errorMessageOptions = {
  loadTodos: 'Unable to load todos',
  emptyTitle: 'Title should not be empty',
  newTodo: 'Unable to add a todo',
  deleteTodo: 'Unable to delete a todo',
  updateTodo: 'Unable to update a todo',
};

const defaultState = {
  todos: [],
  errorMessage: '',
  filteredTodos: [],
  selectedFilter: DefaultFilter.All,
  disableInput: false,
  tempTodo: null,
};

type TempTodo = {
  id: number;
  title: string;
};

export const App: React.FC = () => {
  const [todos, setTodos] = useState<TodoType[]>(defaultState.todos);
  const [errorMessage, setErrorMessage] = useState<string>(
    defaultState.errorMessage,
  );
  const timerId = useRef<ReturnType<typeof setTimeout>>();
  const [selectedFilter, setSelectedFilter] = useState<DefaultFilter>(
    defaultState.selectedFilter,
  );
  const [filteredTodos, setFilteredTodos] = useState<TodoType[]>(
    defaultState.filteredTodos,
  );
  const activeTodos = useRef<number>();
  const [disabledInput, setDisabledInput] = useState(defaultState.disableInput);
  const [tempTodo, setTempTodo] = useState<TempTodo | null>(
    defaultState.tempTodo,
  );
  const [completedTodosAvailabitily, setCompletedTodosAvailability] =
    useState<boolean>(false);
  const [formFocus, setFormFocus] = useState(false);
  const [todosToLoad, setTodosToLoad] = useState<number[]>([]);

  useEffect(() => {
    const atLeastOneTodoCompleted = todos.some(todo => todo.completed === true);

    setCompletedTodosAvailability(previousValue => {
      if (previousValue !== atLeastOneTodoCompleted) {
        return atLeastOneTodoCompleted;
      }

      return previousValue;
    });
  }, [todos]);

  const allTodosCompleted = useMemo(() => {
    const currentActiveTodos = todos.reduce((prev, todo) => {
      if (!todo.completed) {
        return prev + 1;
      }

      return prev;
    }, 0);

    if (todos.length > 0 && currentActiveTodos === 0) {
      return true;
    }

    return false;
  }, [todos]);

  useEffect(() => {
    getTodos()
      .then(setTodos)
      .catch(() => setErrorMessage(errorMessageOptions.loadTodos));
  }, []);

  const handleErrorMessageRemoval = () => {
    clearTimeout(timerId.current);
    setErrorMessage(defaultState.errorMessage);
  };

  useEffect(() => {
    if (errorMessage !== defaultState.errorMessage) {
      clearTimeout(timerId.current);

      timerId.current = setTimeout(() => {
        setErrorMessage(defaultState.errorMessage);
      }, 3000);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (selectedFilter === DefaultFilter.All) {
      setFilteredTodos(todos);
    } else if (selectedFilter === DefaultFilter.Active) {
      setFilteredTodos(todos.filter(todo => todo.completed === false));
    } else {
      setFilteredTodos(todos.filter(todo => todo.completed === true));
    }
  }, [selectedFilter, todos]);

  useEffect(() => {
    activeTodos.current = todos.reduce(
      (prev, todo) => (todo.completed ? prev : prev + 1),
      0,
    );
  }, [todos]);

  if (!USER_ID) {
    return <UserWarning />;
  }

  const showError = (newError: string) => {
    if (errorMessage === newError) {
      clearTimeout(timerId.current);

      timerId.current = setTimeout(() => {
        setErrorMessage(defaultState.errorMessage);
      }, 3000);
    }

    setErrorMessage(newError);
  };

  const handleNewTodo = async (inputValue: string) => {
    if (!inputValue) {
      showError(errorMessageOptions.emptyTitle);

      return false;
    }

    setDisabledInput(true);

    setTempTodo({ id: 0, title: inputValue });

    let result = false;

    await postTodo(inputValue)
      .then(newTodo => {
        setTodos(currentTodos => [...currentTodos, newTodo]);
        handleErrorMessageRemoval();
        result = true;
      })
      .catch(() => {
        showError(errorMessageOptions.newTodo);
      })
      .finally(() => {
        setDisabledInput(false);
        setTempTodo(defaultState.tempTodo);
      });

    return result;
  };

  const handleTodoDeletion = (status: boolean, todoId?: number) => {
    if (!status) {
      showError(errorMessageOptions.deleteTodo);

      return;
    }

    setTodos(currentTodos => currentTodos.filter(todo => todo.id !== todoId));
    setFormFocus(currentValue => !currentValue);
  };

  const handleCompletedTodosDeletion = async () => {
    const todosToDeleteIds = todos
      .filter(todo => {
        if (todo.completed === true) {
          return true;
        }

        return false;
      })
      .map(todo => todo.id);

    setTodosToLoad(todosToDeleteIds);

    const results = await Promise.allSettled(
      todosToDeleteIds.map(id => deleteTodo(id)),
    );

    if (results.some(({ status }) => status === 'rejected')) {
      showError(errorMessageOptions.deleteTodo);
    }

    setTodosToLoad(() => []);

    let filterDeletedTodos = [...todos];

    results.forEach(({ status }, index) => {
      if (status === 'fulfilled') {
        filterDeletedTodos = filterDeletedTodos.filter(
          todo => todo.id !== todosToDeleteIds[index],
        );
      }
    });

    setTodos(() => filterDeletedTodos);
    setFormFocus(true);
  };

  const setChangedTodoStatus = (todoId: number, newStatus: boolean) => {
    setTodos(currentTodos =>
      currentTodos.map(todo => {
        if (todoId === todo.id) {
          const updatedTodo = { ...todo };

          updatedTodo.completed = newStatus;

          return updatedTodo;
        }

        return todo;
      }),
    );
  };

  const handleTodoStatusChange = async (
    todoId: number,
    currentStatus: boolean,
  ): Promise<boolean> => {
    let result = false;

    await updateTodo(todoId, { completed: !currentStatus })
      .then(() => {
        setChangedTodoStatus(todoId, !currentStatus);

        result = true;
      })
      .catch(() => {
        result = false;
        showError(errorMessageOptions.updateTodo);
      });

    return result;
  };

  const handleTodosCompletions = async () => {
    if (allTodosCompleted) {
      setTodosToLoad(todos.map(todo => todo.id));

      const updatesResult = await Promise.allSettled(
        todos.map(todo => updateTodo(todo.id, { completed: !todo.completed })),
      );

      setTodosToLoad([]);

      let promiseFailed = false;

      updatesResult.map((promiseCallResult, index) => {
        if (promiseCallResult.status === 'fulfilled') {
          setChangedTodoStatus(todos[index].id, !todos[index].completed);
        } else {
          promiseFailed = true;
        }
      });

      if (promiseFailed) {
        showError(errorMessageOptions.updateTodo);
      }
    } else {
      setTodosToLoad(
        todos.reduce((prev: number[], todo) => {
          if (!todo.completed) {
            prev.push(todo.id);
          }

          return prev;
        }, []),
      );

      const updatesResult = await Promise.allSettled(
        todos.map(todo => {
          if (todo.completed === false) {
            return updateTodo(todo.id, { completed: !todo.completed });
          }

          return;
        }),
      );

      setTodosToLoad([]);
      let promiseFailed = false;

      updatesResult.map((promiseCallResult, index) => {
        if (
          promiseCallResult.status === 'fulfilled' &&
          todos[index].completed === false
        ) {
          setChangedTodoStatus(todos[index].id, !todos[index].completed);
        }

        if (promiseCallResult.status !== 'fulfilled') {
          promiseFailed = true;
        }
      });

      if (promiseFailed) {
        showError(errorMessageOptions.updateTodo);
      }
    }
  };

  const handleSuccessTitleUpdate = (todoId: number, newTitle: string) => {
    setTodos(currentTodos => {
      return currentTodos.map(todo => {
        if (todo.id === todoId) {
          return { ...todo, title: newTitle };
        }

        return todo;
      });
    });
  };

  const handleFailedTitleUpdate = () => {
    showError(errorMessageOptions.updateTodo);
  };

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {/* this button should have `active` class only if all todos are completed */}
          {todos.length > 0 && (
            <button
              type="button"
              className={cn('todoapp__toggle-all', {
                active: allTodosCompleted,
              })}
              data-cy="ToggleAllButton"
              onClick={handleTodosCompletions}
            />
          )}

          {/* Add a todo on form submit */}
          <NewTodo
            handleNewTodo={handleNewTodo}
            disableInput={disabledInput}
            formFocus={formFocus}
            setFormFocus={() => setFormFocus(currentValue => !currentValue)}
          />
        </header>
        {todos.length > 0 && (
          <TodoList
            todos={filteredTodos}
            handleTodoDeletion={handleTodoDeletion}
            activeTodos={todosToLoad}
            handleStatusChange={handleTodoStatusChange}
            handleSuccessTitleUpdate={handleSuccessTitleUpdate}
            handleFailedTitleUpdate={handleFailedTitleUpdate}
          />
        )}
        {tempTodo !== null && (
          <Todo
            completed={false}
            title={tempTodo.title}
            isActive={true}
            todoId={tempTodo.id}
            activeTodos={todosToLoad}
            handleStatusChange={handleTodoStatusChange}
            onSuccessTitleUpdate={handleSuccessTitleUpdate}
            onFailedTitleUpdate={handleFailedTitleUpdate}
          />
        )}

        {/* Hide the footer if there are no todos */}
        {todos.length > 0 && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {activeTodos.current} items left
            </span>

            {/* Active link should have the 'selected' class */}
            <Filter
              filterValue={selectedFilter}
              onSelectFilter={setSelectedFilter}
            />

            {/* this button should be disabled if there are no completed todos */}

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              onClick={handleCompletedTodosDeletion}
              disabled={!completedTodosAvailabitily}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      {/* DON'T use conditional rendering to hide the notification */}
      {/* Add the 'hidden' class to hide the message smoothly */}
      <div
        data-cy="ErrorNotification"
        className={cn(
          'notification is-danger is-light has-text-weight-normal',
          { hidden: errorMessage === '' },
        )}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={handleErrorMessageRemoval}
        />
        {errorMessage}
      </div>
    </div>
  );
};
