// We use three hooks from react.
import { useState, useRef, useEffect } from "react";

// Symbols are defined in module scope.
// They are used for `snapshot` and `subscribe` functions.
// We use symbols to avoid property name collisions.
const SNAPSHOT = Symbol();
const LISTENERS = Symbol();

// The `proxy` function is to create a "Proxy" object from an initial object.
// This will create a Proxy object with the same shape as the initial object.
// It's very important, we don't add any functionalities at this point.
// The Proxy object is just seamless, and we can use it as a normal object.
export const proxy = (initialObject) => {
  // This listeners Set is to store listeners (=subscribers)
  // to which we notify if the proxy object is mutated.
  // A listener is a function with no arguments.
  const listeners = new Set();
  // This variable is to keep the last created snapshot.
  // It's important to return stable (=unchanged) snapshot,
  // if the proxy object is not mutated.
  let lastSnapshot;
  // `createSnapshot` is a function to create a new snapshot
  // if it hasn't been created, or return the already created snapshot.
  // `target` is a base object passed to `new Proxy()`.
  const createSnapshot = (target) => {
    // Check if a snapshot is already created.
    if (!lastSnapshot) {
      // Create a new snapshot.
      // In this simplified version, it shallow copies the target object.
      // By freezing, we make sure it won't be mutated by chance.
      lastSnapshot = Object.freeze({ ...target });
    }
    // Then, return the created snapshot.
    return lastSnapshot;
  };
  // This is the main part of this function.
  // `new Proxy` takes `target` and `handler` arguments.
  const proxyObject = new Proxy(
    // The target object is newly created.
    // This is to avoid mutating `initialObject`.
    // This is a design choice: mutating `initialObject` is technically
    // possible and somewhat efficient, but it can lead unexpected usages.
    {},
    // The handler object has two methods `get` and `set`
    // in this simplified version.
    // The real implementation has more methods for completeness.
    {
      // `get` handler doesn't do anything except for returning
      // special values for `snapshot` and `subscribe` functions.
      get(target, key) {
        // This is used by the `snapshot` function.
        if (key === SNAPSHOT) {
          return createSnapshot(target);
        }
        // This is used by the `subscribe` function.
        if (key === LISTENERS) {
          return listeners;
        }
        // Otherwise, it behaves like the default behavior.
        return target[key];
      },
      // `set` handler is to detect mutations.
      set(target, key, value) {
        // When mutation happens, we reset snapshot.
        // New snapshot will be created in `createSnapshot`.
        // It's important not to create a new snapshot here in this method.
        // We may mutate object several times before creating a snapshot.
        lastSnapshot = undefined;
        // Do mutation.
        target[key] = value;
        // And notify all listeners.
        listeners.forEach((l) => l());
        // Returning true means this mutation was successful.
        return true;
      },
    }
  );
  // Now, we copy all properties in `initialObject` to `proxyObject`.
  // This will invoke the `set` handler we just defined,
  // but `listeners` are empty and `lastSnapshot` is undefined by default,
  // so copying is no operation.
  // In the real implementation, copying is important to support nesting.
  Object.keys(initialObject).forEach((key) => {
    proxyObject[key] = initialObject[key];
  });
  // Finally, return it.
  return proxyObject;
};

// This function simply delegates the internal `createSnapshot` function.
// The reason we do this is to hide the `SNAPSHOT` symbol as an implementation
// detail, so that we can change it something else in the future.
export const snapshot = (proxy) => proxy[SNAPSHOT];

// Likewise, this function simply modifies the listeners set.
// It adds the callback function to the listeners set when invoked,
// and returns a cleanup function to delete the callback function.
export const subscribe = (proxy, callback) => {
  proxy[LISTENERS].add(callback);
  return () => proxy[LISTENERS].delete(callback);
};

// `useSnapshot` is a function to use snapshot in React.
// It's not just returning a snapshot value.
// To optimize render, it wraps a snapshot object with another Proxy
// with `get` handle to track the property access.
// It will only trigger re-render when accessed properties are changed.
//
// ## Fun Fact
// `proxy` is designed to achieve this render optimization.
// https://react-tracked.js.org has already implemented this feature,
// but in valtio, it's more straightforward because it utilizes Proxy.
export const useSnapshot = (proxy) => {
  // The `useState` state is defined to trigger re-render.
  // This state holds a bare snapshot value.
  // The initial value is a snapshot for a proxy at the first render.
  const [value, setValue] = useState(snapshot(proxy));
  // We define a set in the render function.
  // This is the most important point to allow concurrent rendering.
  // The render function should be pure and should not read or write
  // variables outside the function, such as useRef values.
  const usedKeys = new Set();
  // We create two refs with useRef to keep the committed `value` and
  // `usedKeys` variables.
  // Later, we use them in a callback function.
  const lastValue = useRef();
  const lastUsed = useRef();
  // We use useEffect to update the ref values.
  // Note again that render can happen multiple times before committing.
  // Any values including useRef should be mutated in effects.
  useEffect(() => {
    lastValue.current = value;
    lastUsed.current = usedKeys;
  });
  // This is an effect to subscribe to the proxy object.
  useEffect(() => {
    // This is a function to add to the listeners set with `subscribe`.
    // It will be invoked every time the proxy is mutated.
    const callback = () => {
      // First, we get the next value.
      // Calling `snapshot` means we create a snapshot at this point.
      // The real implementation has "batching", but in this simplified
      // version, we create a snapshot every time.
      const nextValue = snapshot(proxy);
      // Second, we grab the current value from the ref value.
      const value = lastValue.current;
      // We also get committed `usedKeys` from the ref value.
      const usedKeys = lastUsed.current;
      // Now, check if all property values in `usedKeys` is not changed.
      if (
        // We make sure `usedKeys` is not empty.
        // If it's empty, we simply assume the entire object as used.
        // It means, when it's empty, it always triggers re-render.
        // This might sound counter-intuitive, but this behavior is
        // more consistent and less error-prune.
        usedKeys.size &&
        // Check if all usedKeys with Array.every.
        // `[...usedKeys]` is to convert a set to an array.
        // We shallow compare with `===` in the simplified version.
        // The real implementation supports nested objects.
        [...usedKeys].every((key) => value[key] === nextValue[key])
      ) {
        // not changed
      } else {
        // If we detect changes in the values in `usedKeys`,
        // we set the next snapshot value.
        // This tells React to re-render.
        setValue(nextValue);
      }
    };
    // Subscribe the callback function to the proxy object.
    // The return value is stored in the unsubscribe variable.
    const unsubscribe = subscribe(proxy, callback);
    // We invoke the callback function immediately.
    // This is important because `proxy` variable can be changed
    // after the initial render.
    // Also mutations can happen after the first render before the effect,
    // hence invoking the callback function once is necessary too.
    // Technically, this can be done before the `subscribe` line,
    // but this seems like a safer pattern
    // without assuming the `subscribe` behavior.
    callback();
    // Finally, we return `unsubscribe` as a cleanup function.
    return unsubscribe;
    // Again, it's important that we support changing `proxy` variable.
  }, [proxy]);
  // This is the last part to combine all the tricks.
  // Instead of returning the bare snapshot `value`,
  // we wrap it with another Proxy to track property access.
  return new Proxy(value, {
    // We have one `get` handler for read.
    // On the other hand `proxy` function creates a Proxy object
    // with `set` handler. (We had `get` handler in `proxy` too, but
    // it's only to delegate functionalities.)
    get(target, key) {
      // When `get` is called, we add the `key` to `usedKeys`.
      // This is safe operation in concurrent rendering,
      // because `usedKeys` are local in the render function scope.
      usedKeys.add(key);
      // Finally, we return the property value, which is the default behavior.
      return target[key];
    },
  });
};