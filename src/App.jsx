import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Minus, Settings, ShoppingBag, LogOut, Trash2 } from 'lucide-react';

const supabase = createClient('https://bkpqmzilspwpwovyycgc.supabase.co', 'sb_publishable_85iTt9YZ9OUvPwy1oU6KPg_MzLC1hG6');

const ADMIN_EMAIL_ALLOWLIST = [];

const formatCLP = (value) => {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(numberValue);
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const usePathname = () => {
  const [pathname, setPathname] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return pathname;
};

const PublicPage = () => {
  const [productos, setProductos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchProductos = async () => {
    setIsLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.from('productos').select('*').order('id');
    if (error) {
      setErrorMessage(error.message);
      setProductos([]);
      setIsLoading(false);
      return;
    }
    setProductos(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight">ArteManí</h1>
          <a href="/admin" className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-4">
            Admin
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg font-semibold">Sabores disponibles</h2>
            <p className="text-slate-500 text-sm">Stock y precios en tiempo real</p>
          </div>
          <button onClick={fetchProductos} className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            Actualizar
          </button>
        </div>

        {errorMessage ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>
        ) : null}

        {isLoading ? (
          <div className="text-slate-500">Cargando…</div>
        ) : (
          <div className="grid gap-4">
            {productos.map((p) => {
              const agotado = (p.stock ?? 0) <= 0;
              return (
                <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                  <div className="min-w-0">
                    <h3 className={`text-lg font-semibold truncate ${agotado ? 'line-through text-slate-400' : ''}`}>{p.nombre}</h3>
                    <p className={`text-sm ${agotado ? 'text-slate-400' : 'text-slate-500'}`}>{formatCLP(p.precio)}</p>
                  </div>

                  <div className="text-right">
                    {agotado ? (
                      <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">Agotado</span>
                    ) : (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                        {p.stock} disponibles
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

const AdminPage = () => {
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');

  const [productos, setProductos] = useState([]);
  const [isLoadingProductos, setIsLoadingProductos] = useState(true);
  const [productosError, setProductosError] = useState('');

  const [ventas, setVentas] = useState([]);
  const [ventasError, setVentasError] = useState('');

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState(1200);
  const [nuevoStock, setNuevoStock] = useState(0);

  const [ventaProductoId, setVentaProductoId] = useState('');
  const [ventaCantidad, setVentaCantidad] = useState(1);
  const [ventaError, setVentaError] = useState('');
  const [isSavingVenta, setIsSavingVenta] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session ?? null);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const resolveAdminAccess = async (currentSession) => {
    setAdminError('');
    if (!currentSession?.user) {
      setIsAdmin(false);
      return;
    }

    const userId = currentSession.user.id;
    const userEmail = currentSession.user.email || '';

    const { data, error } = await supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
    if (!error) {
      setIsAdmin(Boolean(data?.user_id));
      return;
    }

    if (ADMIN_EMAIL_ALLOWLIST.length > 0 && userEmail) {
      setIsAdmin(ADMIN_EMAIL_ALLOWLIST.includes(userEmail));
      return;
    }

    setIsAdmin(false);
    setAdminError('No se pudo verificar admin (falta tabla admin_users o política).');
  };

  useEffect(() => {
    resolveAdminAccess(session);
  }, [session?.user?.id]);

  const fetchProductos = async () => {
    setIsLoadingProductos(true);
    setProductosError('');
    const { data, error } = await supabase.from('productos').select('*').order('id');
    if (error) {
      setProductos([]);
      setProductosError(error.message);
      setIsLoadingProductos(false);
      return;
    }
    setProductos(data || []);
    setIsLoadingProductos(false);
  };

  const fetchVentas = async () => {
    setVentasError('');
    const { data, error } = await supabase
      .from('ventas')
      .select('id,cantidad,precio_unitario,created_at,producto:productos(id,nombre)')
      .order('created_at', { ascending: false })
      .limit(250);

    if (error) {
      setVentas([]);
      setVentasError(error.message);
      return;
    }
    setVentas(data || []);
  };

  useEffect(() => {
    if (!session?.user) return;
    fetchProductos();
    fetchVentas();
  }, [session?.user?.id]);

  const signIn = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    setIsSigningIn(false);
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProducto = async (id, patch) => {
    setProductosError('');
    const { error } = await supabase.from('productos').update(patch).eq('id', id);
    if (error) {
      setProductosError(error.message);
      return;
    }
    await fetchProductos();
  };

  const deleteProducto = async (id) => {
    setProductosError('');
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) {
      setProductosError(error.message);
      return;
    }
    await fetchProductos();
  };

  const addProducto = async (e) => {
    e.preventDefault();
    setProductosError('');
    const nombre = nuevoNombre.trim();
    const precio = Number(nuevoPrecio);
    const stock = Number(nuevoStock);

    if (!nombre) {
      setProductosError('El nombre es obligatorio.');
      return;
    }

    const { error } = await supabase.from('productos').insert([{ nombre, precio: Number.isFinite(precio) ? precio : null, stock: Number.isFinite(stock) ? stock : 0 }]);
    if (error) {
      setProductosError(error.message);
      return;
    }

    setNuevoNombre('');
    setNuevoPrecio(1200);
    setNuevoStock(0);
    await fetchProductos();
  };

  const registrarVenta = async (e) => {
    e.preventDefault();
    setVentaError('');
    setVentasError('');

    const productoId = Number(ventaProductoId);
    const cantidad = Number(ventaCantidad);

    if (!Number.isFinite(productoId) || !Number.isFinite(cantidad) || cantidad <= 0) {
      setVentaError('Selecciona producto y cantidad válida.');
      return;
    }

    const producto = productos.find((p) => Number(p.id) === productoId);
    if (!producto) {
      setVentaError('Producto no encontrado.');
      return;
    }

    const stockActual = Number(producto.stock ?? 0);
    if (stockActual < cantidad) {
      setVentaError('No hay stock suficiente.');
      return;
    }

    setIsSavingVenta(true);
    const { error: ventaInsertError } = await supabase.from('ventas').insert([
      {
        producto_id: productoId,
        cantidad,
        precio_unitario: Number(producto.precio ?? 0),
      },
    ]);

    if (ventaInsertError) {
      setVentaError(ventaInsertError.message);
      setIsSavingVenta(false);
      return;
    }

    const { error: stockError } = await supabase.from('productos').update({ stock: stockActual - cantidad }).eq('id', productoId);
    if (stockError) {
      setVentaError(`Venta guardada, pero falló actualización de stock: ${stockError.message}`);
      setIsSavingVenta(false);
      await fetchVentas();
      await fetchProductos();
      return;
    }

    setVentaProductoId('');
    setVentaCantidad(1);
    setIsSavingVenta(false);
    await fetchVentas();
    await fetchProductos();
  };

  const ventasHoy = ventas.filter((v) => new Date(v.created_at) >= startOfToday());
  const ventasMes = ventas.filter((v) => new Date(v.created_at) >= startOfMonth());

  const totalHoy = ventasHoy.reduce((acc, v) => acc + Number(v.cantidad ?? 0) * Number(v.precio_unitario ?? 0), 0);
  const totalMes = ventasMes.reduce((acc, v) => acc + Number(v.cantidad ?? 0) * Number(v.precio_unitario ?? 0), 0);

  const unidadesMesPorProducto = ventasMes.reduce((acc, v) => {
    const productoNombre = v.producto?.nombre || `Producto ${v.producto?.id ?? ''}`.trim();
    const current = acc.get(productoNombre) || 0;
    acc.set(productoNombre, current + Number(v.cantidad ?? 0));
    return acc;
  }, new Map());

  const topMes = Array.from(unidadesMesPorProducto.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Settings size={18} />
              Admin
            </h1>
            <a href="/" className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-4">
              Volver
            </a>
          </div>
        </header>

        <main className="max-w-md mx-auto p-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Iniciar sesión</h2>
            <p className="text-sm text-slate-500 mb-5">Solo para administración</p>

            {authError ? <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4">{authError}</div> : null}

            <form onSubmit={signIn} className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Email</span>
                <input
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  type="email"
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  required
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Contraseña</span>
                <input
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  type="password"
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  required
                />
              </label>
              <button
                disabled={isSigningIn}
                className="mt-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                type="submit"
              >
                {isSigningIn ? 'Ingresando…' : 'Ingresar'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Settings size={18} />
              Admin
            </h1>
            <div className="flex items-center gap-3">
              <a href="/" className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-4">
                Volver
              </a>
              <button onClick={signOut} className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                <LogOut size={16} />
                Salir
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl p-5">
            <p className="font-semibold">Sesión iniciada, pero sin permisos de admin.</p>
            {adminError ? <p className="mt-2 text-sm">{adminError}</p> : null}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingBag size={18} />
            Panel Admin
          </h1>
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-4">
              Público
            </a>
            <button onClick={signOut} className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 grid gap-6">
        <section className="grid md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="text-sm text-slate-500">Ventas hoy</div>
            <div className="text-2xl font-bold mt-1">{formatCLP(totalHoy)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="text-sm text-slate-500">Ventas mes</div>
            <div className="text-2xl font-bold mt-1">{formatCLP(totalMes)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="text-sm text-slate-500">Top mes (unidades)</div>
            <div className="mt-2 grid gap-1">
              {topMes.length === 0 ? <div className="text-sm text-slate-500">Sin datos</div> : null}
              {topMes.map(([nombre, unidades]) => (
                <div key={nombre} className="flex justify-between text-sm">
                  <span className="truncate pr-3">{nombre}</span>
                  <span className="font-mono">{unidades}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Registrar venta</h2>
              <p className="text-sm text-slate-500">Descuenta stock y guarda el historial</p>
            </div>
            <button onClick={fetchVentas} className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              Actualizar ventas
            </button>
          </div>

          {ventaError ? <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4">{ventaError}</div> : null}
          {ventasError ? <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4">{ventasError}</div> : null}

          <form onSubmit={registrarVenta} className="grid md:grid-cols-3 gap-3 items-end">
            <label className="grid gap-1">
              <span className="text-sm text-slate-600">Producto</span>
              <select
                value={ventaProductoId}
                onChange={(e) => setVentaProductoId(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                required
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id} disabled={(p.stock ?? 0) <= 0}>
                    {p.nombre} ({p.stock ?? 0})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-slate-600">Cantidad</span>
              <input
                value={ventaCantidad}
                onChange={(e) => setVentaCantidad(e.target.value)}
                type="number"
                min={1}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSavingVenta}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isSavingVenta ? 'Guardando…' : 'Registrar'}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="text-sm font-semibold mb-2">Últimas ventas</div>
            {ventas.length === 0 ? (
              <div className="text-sm text-slate-500">Sin ventas registradas</div>
            ) : (
              <div className="grid gap-2">
                {ventas.slice(0, 12).map((v) => (
                  <div key={v.id} className="flex justify-between items-center text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate">{v.producto?.nombre || 'Producto'}</div>
                      <div className="text-xs text-slate-500">{new Date(v.created_at).toLocaleString('es-CL')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">
                        {v.cantidad} × {formatCLP(v.precio_unitario)}
                      </div>
                      <div className="font-semibold">{formatCLP(Number(v.cantidad ?? 0) * Number(v.precio_unitario ?? 0))}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Inventario</h2>
              <p className="text-sm text-slate-500">Editar precios y stock</p>
            </div>
            <button onClick={fetchProductos} className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              Actualizar inventario
            </button>
          </div>

          {productosError ? <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4">{productosError}</div> : null}

          <form onSubmit={addProducto} className="grid md:grid-cols-4 gap-3 items-end mb-5">
            <label className="grid gap-1 md:col-span-2">
              <span className="text-sm text-slate-600">Nuevo producto</span>
              <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg bg-white" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-slate-600">Precio</span>
              <input
                value={nuevoPrecio}
                onChange={(e) => setNuevoPrecio(e.target.value)}
                type="number"
                min={0}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-slate-600">Stock</span>
              <input
                value={nuevoStock}
                onChange={(e) => setNuevoStock(e.target.value)}
                type="number"
                min={0}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
              />
            </label>
            <button type="submit" className="md:col-span-4 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800">
              Agregar producto
            </button>
          </form>

          {isLoadingProductos ? (
            <div className="text-slate-500">Cargando inventario…</div>
          ) : (
            <div className="grid gap-3">
              {productos.map((p) => (
                <div key={p.id} className="border border-slate-200 rounded-2xl p-4 bg-white">
                  <div className="grid md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-5 min-w-0">
                      <div className="text-xs text-slate-500">Nombre</div>
                      <input
                        defaultValue={p.nombre}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next && next !== p.nombre) updateProducto(p.id, { nombre: next });
                          if (!next) e.target.value = p.nombre;
                        }}
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-xs text-slate-500">Precio</div>
                      <input
                        defaultValue={p.precio ?? 0}
                        type="number"
                        min={0}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (Number.isFinite(next) && next !== Number(p.precio ?? 0)) updateProducto(p.id, { precio: next });
                        }}
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <div className="text-xs text-slate-500">Stock</div>
                      <div className="mt-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => updateProducto(p.id, { stock: Math.max(0, Number(p.stock ?? 0) - 1) })}
                          className="p-2 bg-white rounded-md border border-slate-200 hover:text-red-600"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          defaultValue={p.stock ?? 0}
                          type="number"
                          min={0}
                          onBlur={(e) => {
                            const next = Number(e.target.value);
                            if (Number.isFinite(next) && next !== Number(p.stock ?? 0)) updateProducto(p.id, { stock: Math.max(0, next) });
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => updateProducto(p.id, { stock: Number(p.stock ?? 0) + 1 })}
                          className="p-2 bg-white rounded-md border border-slate-200 hover:text-green-600"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => deleteProducto(p.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const App = () => {
  const pathname = usePathname();

  if (pathname === '/admin') return <AdminPage />;
  if (pathname === '/' || pathname === '') return <PublicPage />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-md w-full">
        <div className="text-lg font-semibold">Ruta no encontrada</div>
        <div className="text-sm text-slate-500 mt-1">Prueba ir al inicio o al panel admin.</div>
        <div className="flex gap-3 mt-5">
          <a className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800" href="/">
            Inicio
          </a>
          <a className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50" href="/admin">
            Admin
          </a>
        </div>
      </div>
    </div>
  );
};

export default App;
