import { useEffect, useCallback, useStat } from "react";

const useProxyState = (init) => {
  const [store, setStore] = useState(init);

  const [, updateState] = useState();

  const forceUpdate = useCallback(() => updateState({}), []);

  const usedKeys = new Set();

  // const lastValue = useRef();
  // const lastUsed = useRef();
  // // We use useEffect to update the ref values.
  // // Note again that render can happen multiple times before committing.
  // // Any values including useRef should be mutated in effects.
  // useEffect(() => {
  //   lastValue.current = value;
  //   lastUsed.current = usedKeys;
  // });
  // const nextValue = useState();

  const proxyState = new Proxy(init, {
    get(target, key) {
      if (store[key]) {
        console.log("retuen store", store);
        return store[key];
      }
      // Otherwise, it behaves like the default behavior.
      return target[key];
    },
    set(target, key, value) {
      console.log("setting store");
      let newStore = store;
      newStore[key] = value;
      console.log(`setting ${key} to ${value}`);
      setStore(newStore);
      forceUpdate();

      target[key] = value;
      return true;
    }
  });

  useCallback(() => {
    console.log("Changed");
    const callback = () => {
      if (
        usedKeys.size
        // &&
        // [...usedKeys].every((key) => store[key] === nextValue[key])
      ) {
        // do ccc
        console.log("changeds1s sss");
      } else {
        // setBexvalue;
      }
    };
    callback();
  }, [store]);

  return new Proxy(proxyState, {
    get(target, key) {
      // usedKeys.add(key);
      console.log("ssss", proxyState[key]);
      return proxyState[key];
    }
  });
  // return proxyState;
};

export default useProxyState;
