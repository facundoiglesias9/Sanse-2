"use client"

import * as React from "react"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, Search, Filter, Package } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { toggleStock } from "@/app/actions/stock-actions"
import { toast } from "sonner"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { capitalizeFirstLetter } from "@/app/helpers/capitalizeFirstLetter"

type StockItem = {
    id: string
    nombre: string
    proveedor?: string
    categoria?: string
    familia_olfativa?: string
    genero?: string
    stock_al_momento: boolean
}

type StockListProps = {
    data: StockItem[]
    proveedores: string[]
    categorias: string[]
    familias: string[]
}

export function StockList({ data, proveedores, categorias, familias }: StockListProps) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

    const columns: ColumnDef<StockItem>[] = [
        {
            accessorKey: "nombre",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="pl-0"
                    >
                        Nombre
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <div className="font-medium">{row.getValue("nombre")}</div>,
        },
        {
            accessorKey: "genero",
            header: "Género",
            cell: ({ row }) => {
                const gen = row.getValue("genero") as string;
                if (!gen) return null;
                return (
                    <Badge variant={gen === "masculino" ? "indigo" : gen === "femenino" ? "pink" : "default"}>
                        {capitalizeFirstLetter(gen)}
                    </Badge>
                )
            },
            filterFn: (row, id, value) => {
                return value === "todos" || row.getValue(id) === value;
            }
        },
        {
            accessorKey: "categoria",
            header: "Categoría",
            cell: ({ row }) => {
                const cat = row.getValue("categoria") as string;
                return cat ? <Badge variant="outline">{cat}</Badge> : null;
            },
            filterFn: (row, id, value) => {
                return value === "todos" || row.getValue(id) === value;
            }
        },
        {
            accessorKey: "familia_olfativa",
            header: "Familia Olfativa",
            cell: ({ row }) => {
                const val = row.getValue("familia_olfativa") as string;
                return val ? <span className="text-sm text-muted-foreground">{val}</span> : null;
            },
            filterFn: (row, id, value) => {
                if (value === "todos") return true;
                const rowVal = row.getValue(id) as string;
                return rowVal?.includes(value);
            }
        },
        {
            accessorKey: "proveedor",
            header: "Proveedor",
            cell: ({ row }) => {
                const prov = row.getValue("proveedor") as string;
                return prov ? <Badge variant="secondary">{prov}</Badge> : null;
            },
            filterFn: (row, id, value) => {
                return value === "todos" || row.getValue(id) === value;
            }
        },
        {
            accessorKey: "stock_al_momento",
            header: "Stock Disponible",
            cell: ({ row }) => {
                const stock = row.original.stock_al_momento
                const id = row.original.id

                const handleToggle = async () => {
                    const promise = toggleStock(id, stock);

                    toast.promise(promise, {
                        loading: 'Actualizando...',
                        success: 'Estado de stock actualizado',
                        error: 'Error al actualizar'
                    });
                }

                return (
                    <div className="flex items-center space-x-2">
                        <Switch
                            checked={stock}
                            onCheckedChange={handleToggle}
                        />
                        <span className="text-sm text-muted-foreground">
                            {stock ? "Sí" : "No"}
                        </span>
                    </div>
                )
            },
            filterFn: (row, id, value) => {
                if (value === "todos") return true;
                const available = row.getValue(id) as boolean;
                if (value === "disponibles") return available === true;
                if (value === "no_disponibles") return available === false;
                return true;
            }
        },
    ]

    // Calculate stats
    const categoryStats = React.useMemo(() => {
        return categorias.map(cat => ({
            name: cat,
            count: data.filter(d => d.categoria === cat && d.stock_al_momento).length
        }));
    }, [categorias, data]);

    const handleCardClick = (categoryName: string) => {
        const currentCategoryFilter = table.getColumn("categoria")?.getFilterValue() as string;
        const currentStockFilter = table.getColumn("stock_al_momento")?.getFilterValue() as string;

        // If clicking the same active category card, clear filters
        if (currentCategoryFilter === categoryName && currentStockFilter === "disponibles") {
            table.getColumn("categoria")?.setFilterValue(undefined);
            table.getColumn("stock_al_momento")?.setFilterValue(undefined);
        } else {
            // Set category and force stock to 'disponibles'
            table.getColumn("categoria")?.setFilterValue(categoryName);
            table.getColumn("stock_al_momento")?.setFilterValue("disponibles");
        }
    };

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        autoResetPageIndex: false,
        state: {
            sorting,
            columnFilters,
        },
    })

    return (
        <div className="w-full space-y-4">
            {/* Stats Cards */}
            <div className="flex flex-wrap justify-center gap-6 mb-8">
                {categoryStats.map((stat, index) => {
                    const colors = [
                        { border: "border-blue-500", text: "text-blue-500", bg: "bg-blue-500" },
                        { border: "border-purple-500", text: "text-purple-500", bg: "bg-purple-500" },
                        { border: "border-pink-500", text: "text-pink-500", bg: "bg-pink-500" },
                        { border: "border-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500" },
                        { border: "border-amber-500", text: "text-amber-500", bg: "bg-amber-500" },
                        { border: "border-cyan-500", text: "text-cyan-500", bg: "bg-cyan-500" },
                    ];
                    const theme = colors[index % colors.length];
                    const isActive = (table.getColumn("categoria")?.getFilterValue() as string) === stat.name;

                    return (
                        <Card
                            key={stat.name}
                            onClick={() => handleCardClick(stat.name)}
                            className={`min-w-[240px] relative overflow-hidden bg-zinc-900/50 border-zinc-800 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group cursor-pointer ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        >
                            <div className={`absolute top-0 left-0 w-1 h-full ${theme.bg} opacity-80`} />

                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-zinc-400">
                                    {stat.name}
                                </CardTitle>
                                <div className={`p-2 rounded-xl bg-zinc-950 border border-zinc-800 group-hover:border-zinc-700 transition-colors`}>
                                    <Package className={`h-4 w-4 ${theme.text}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold tracking-tight text-zinc-100">
                                    {stat.count}
                                </div>
                                <p className={`text-xs font-semibold mt-2 uppercase tracking-wider ${theme.text} opacity-80`}>
                                    Disponibles
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Filters Container */}
            <div className="flex flex-col gap-4 py-4">

                {/* Row 1: Search & Basic Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative w-full">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar productos..."
                            value={(table.getColumn("nombre")?.getFilterValue() as string) ?? ""}
                            onChange={(event) =>
                                table.getColumn("nombre")?.setFilterValue(event.target.value)
                            }
                            className="pl-8"
                        />
                    </div>

                    {/* Filter: Género */}
                    <Select
                        onValueChange={(value) =>
                            table.getColumn("genero")?.setFilterValue(value === "todos" ? undefined : value)
                        }
                    >
                        <SelectTrigger className="w-full bg-background">
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Género" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="masculino">Masculino</SelectItem>
                            <SelectItem value="femenino">Femenino</SelectItem>
                            <SelectItem value="ambiente">Ambiente</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Filter: Categoría */}
                    <Select
                        onValueChange={(value) =>
                            table.getColumn("categoria")?.setFilterValue(value === "todos" ? undefined : value)
                        }
                    >
                        <SelectTrigger className="w-full bg-background">
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Categoría" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas</SelectItem>
                            {categorias.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                    {cat}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Filter: Proveedor */}
                    <Select
                        onValueChange={(value) =>
                            table.getColumn("proveedor")?.setFilterValue(value === "todos" ? undefined : value)
                        }
                    >
                        <SelectTrigger className="w-full bg-background">
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Proveedor" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            {proveedores.map((prov) => (
                                <SelectItem key={prov} value={prov}>
                                    {prov}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>



                {/* Row 2: Advanced Filters (Olfactory Family & Stock Status) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Filter: Stock Status */}
                    <Select
                        onValueChange={(value) =>
                            table.getColumn("stock_al_momento")?.setFilterValue(value === "todos" ? undefined : value)
                        }
                        value={(table.getColumn("stock_al_momento")?.getFilterValue() as string) || "todos"}
                    >
                        <SelectTrigger className="w-full bg-background">
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Estado de Stock" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="disponibles">Solo Disponibles</SelectItem>
                            <SelectItem value="no_disponibles">No Disponibles</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Filter: Familia Olfativa */}
                    <Select
                        onValueChange={(value) =>
                            table.getColumn("familia_olfativa")?.setFilterValue(value === "todos" ? undefined : value)
                        }
                    >
                        <SelectTrigger className="w-full bg-background">
                            <div className="flex items-center gap-2 truncate">
                                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Familia Olfativa" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas</SelectItem>
                            {familias.map((fam) => (
                                <SelectItem key={fam} value={fam}>
                                    {fam}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="hover:bg-muted"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No se encontraron resultados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <DataTablePagination table={table} />
        </div >
    )
}
