"use client";

import { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Pencil, Trash2, Plus, Users, ShieldCheck, ShieldAlert, UserCog, Eye, EyeOff } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { updateUserPassword, deleteUser, createUser, getUsers, updateUserRole } from "./actions";
import { getGlobalConfig, updateGlobalConfig } from "@/app/actions/config-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getPasswordStrength, getStrengthLabel, passwordSchema } from "@/lib/password-utils";
import { PasswordRequirements } from "@/components/password-requirements";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

function PasswordStrengthMeter({ password }: { password: string; }) {
    const score = getPasswordStrength(password);
    const strength = getStrengthLabel(score);

    return (
        <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground">Fortaleza</span>
                <span className={cn("text-xs font-medium",
                    score >= 4 ? "text-green-600" :
                        score === 3 ? "text-yellow-600" : "text-red-600"
                )}>
                    {strength.text}
                </span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <motion.div
                    className={cn("h-full", strength.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${(score / 5) * 100}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>
        </div>
    );
}

export default function GestionUsuariosPage() {
    const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
    const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

    const [profiles, setProfiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Estado del diálogo de edición
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [newPassword, setNewPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Estado del diálogo de eliminación
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Estado de creación de usuario
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newUserUsername, setNewUserUsername] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [newUserRole, setNewUserRole] = useState("comprador");
    const [isCreating, setIsCreating] = useState(false);

    // Estado visibilidad contraseñas
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showCreateUserPassword, setShowCreateUserPassword] = useState(false);

    // Estado foco inputs contraseña
    const [isNewPasswordFocused, setIsNewPasswordFocused] = useState(false);
    const [isCreateUserPasswordFocused, setIsCreateUserPasswordFocused] = useState(false);

    // Obtener usuarios y config
    const fetchProfiles = async () => {
        setIsLoading(true);
        const [usersResult, maintenanceResult] = await Promise.all([
            getUsers(),
            getGlobalConfig('maintenance_mode')
        ]);

        if (usersResult.error) {
            toast.error("Error al cargar usuarios");
            console.error(usersResult.error);
        } else {
            setProfiles(usersResult.users || []);
        }

        setIsMaintenanceMode(maintenanceResult === 'true');
        setIsLoading(false);
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleMaintenanceToggle = async (checked: boolean) => {
        setIsUpdatingConfig(true);
        // Actualización optimista
        setIsMaintenanceMode(checked);

        const result = await updateGlobalConfig('maintenance_mode', String(checked));

        if (result.error) {
            toast.error("Error al actualizar modo mantenimiento");
            setIsMaintenanceMode(!checked); // Revertir
        } else {
            toast.success(checked ? "Modo mantenimiento ACTIVADO" : "Modo mantenimiento DESACTIVADO");
        }
        setIsUpdatingConfig(false);
    };

    const handleEditClick = (user: any) => {
        setSelectedUser(user);
        setNewPassword("");
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (user: any) => {
        setUserToDelete(user);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);

        const result = await deleteUser(userToDelete.id);

        setIsDeleting(false);
        setIsDeleteDialogOpen(false);

        if (result.error) {
            toast.error("Error al eliminar usuario", { description: result.error });
        } else {
            toast.success(`Usuario ${userToDelete.nombre} eliminado`);
            fetchProfiles(); // Actualizar lista
        }
    };

    const handleCreateUser = async () => {
        if (!newUserUsername.trim() || !newUserPassword.trim()) {
            toast.error("Por favor complete todos los campos");
            return;
        }

        if (!passwordSchema.safeParse(newUserPassword).success) {
            toast.error("Contraseña insegura", {
                description: "Debe tener 8+ caracteres, mayúscula, minúscula, número y símbolo."
            });
            return;
        }

        setIsCreating(true);
        const result = await createUser({
            username: newUserUsername,
            password: newUserPassword,
            rol: newUserRole,
        });
        setIsCreating(false);

        if (result.error) {
            toast.error("Error al crear usuario", { description: result.error });
        } else {
            toast.success("Usuario creado exitosamente");
            setIsCreateDialogOpen(false);
            setNewUserUsername("");
            setNewUserPassword("");
            setNewUserRole("comprador");
            fetchProfiles();
        }
    };

    const handleSavePassword = async () => {
        if (!selectedUser) return;

        if (!passwordSchema.safeParse(newPassword).success) {
            toast.error("Contraseña insegura", {
                description: "Debe tener 8+ caracteres, mayúscula, minúscula, número y símbolo."
            });
            return;
        }

        setIsSaving(true);
        const result = await updateUserPassword(selectedUser.id, newPassword);
        setIsSaving(false);

        if (result.error) {
            toast.error("Error al actualizar contraseña", {
                description: result.error,
            });
        } else {
            toast.success(`Contraseña actualizada para ${selectedUser.nombre}`);
            setIsDialogOpen(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        // Actualización optimista
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, rol: newRole } : p));

        const result = await updateUserRole(userId, newRole);
        if (result.error) {
            toast.error("Error al actualizar rol");
            // Revertir
            fetchProfiles();
        } else {
            toast.success("Rol actualizado");
        }
    };

    return (
        <div className="container mx-auto py-10 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de usuarios</h1>
                    <p className="text-muted-foreground mt-1">Administra usuarios, roles y configuraciones globales.</p>
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)} className="shadow-sm">
                    <Plus className="h-4 w-4" />Nuevo Usuario
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-card/50 backdrop-blur-sm shadow-sm border-muted/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Modo Mantenimiento</CardTitle>
                        {isMaintenanceMode ? (
                            <ShieldAlert className="h-4 w-4 text-amber-500" />
                        ) : (
                            <ShieldCheck className="h-4 w-4 text-green-500" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between mt-2">
                            <div className="flex flex-col space-y-1">
                                <span className={`text-2xl font-bold ${isMaintenanceMode ? "text-amber-500" : "text-green-600"}`}>
                                    {isMaintenanceMode ? "Activado" : "Desactivado"}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                    {isMaintenanceMode
                                        ? "Solo administradores pueden acceder"
                                        : "El sitio es accesible para todos"}
                                </p>
                            </div>
                            <Switch
                                checked={isMaintenanceMode}
                                onCheckedChange={handleMaintenanceToggle}
                                disabled={isUpdatingConfig || isLoading}
                                aria-label="Alternar modo mantenimiento"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm shadow-sm border-muted/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold mt-2">{isLoading ? <Skeleton className="h-8 w-16" /> : profiles.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Usuarios registrados en la plataforma
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm shadow-sm border-muted/60 hidden md:block">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Roles Activos</CardTitle>
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2 mt-3">
                            {isLoading ? (
                                <Skeleton className="h-6 w-full" />
                            ) : (
                                <>
                                    <Badge variant="secondary" className="text-xs">
                                        {profiles.filter(p => p.rol === 'admin').length} Admin
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                        {profiles.filter(p => p.rol === 'revendedor').length} Revend.
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                        {profiles.filter(p => p.rol === 'comprador').length} Compr.
                                    </Badge>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border-muted/60">
                <CardHeader>
                    <CardTitle>Directorio de Usuarios</CardTitle>
                    <CardDescription>
                        Visualiza y gestiona los usuarios registrados y sus permisos.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Avatar</TableHead>
                                <TableHead>Información</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                                        <TableCell>
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-[150px]" />
                                                <Skeleton className="h-3 w-[100px]" />
                                            </div>
                                        </TableCell>
                                        <TableCell><Skeleton className="h-8 w-[100px]" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                profiles.map((profile) => (
                                    <TableRow key={profile.id} className="group hover:bg-muted/40 transition-colors">
                                        <TableCell>
                                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                    {profile.nombre ? profile.nombre.charAt(0).toUpperCase() : "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{profile.nombre}</span>
                                                <span className="text-xs text-muted-foreground">{profile.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={profile.rol}
                                                onValueChange={(val) => handleRoleChange(profile.id, val)}
                                            >
                                                <SelectTrigger className="w-[140px] h-8 bg-transparent border-transparent hover:border-input focus:ring-0 focus:ring-offset-0 transition-all font-medium text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Administrador</SelectItem>
                                                    <SelectItem value="revendedor">Revendedor</SelectItem>
                                                    <SelectItem value="comprador">Comprador</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                                                    onClick={() => handleEditClick(profile)}
                                                    title="Cambiar contraseña"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
                                                    onClick={() => handleDeleteClick(profile)}
                                                    title="Eliminar usuario"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Diálogo Editar Contraseña */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cambiar contraseña</DialogTitle>
                        <DialogDescription>
                            Ingrese la nueva contraseña para <span className="font-medium text-foreground">{selectedUser?.nombre}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Nueva contraseña</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder="Mínimo 8 caracteres..."
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    onFocus={() => setIsNewPasswordFocused(true)}
                                    onBlur={() => setIsNewPasswordFocused(false)}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                            {isNewPasswordFocused && (
                                <div className="absolute top-full left-0 w-full mt-1 z-50">
                                    <PasswordRequirements password={newPassword} />
                                </div>
                            )}
                            <PasswordStrengthMeter password={newPassword} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSavePassword} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Alerta de Confirmación de Eliminación */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción es irreversible. Se eliminará permanentemente al usuario <span className="font-medium text-foreground">{userToDelete?.nombre}</span> y todos sus datos asociados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Diálogo Crear Usuario */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                        <DialogDescription>
                            Complete los datos para dar de alta un nuevo usuario en el sistema.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="newUsername">Nombre de Usuario</Label>
                            <Input
                                id="newUsername"
                                placeholder="Ej: juanperez"
                                value={newUserUsername}
                                onChange={(e) => setNewUserUsername(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="newRole">Rol Asignado</Label>
                            <Select value={newUserRole} onValueChange={setNewUserRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="revendedor">Revendedor</SelectItem>
                                    <SelectItem value="comprador">Comprador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="newPassword">Contraseña Inicial</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showCreateUserPassword ? "text" : "password"}
                                    placeholder="********"
                                    value={newUserPassword}
                                    onChange={(e) => setNewUserPassword(e.target.value)}
                                    onFocus={() => setIsCreateUserPasswordFocused(true)}
                                    onBlur={() => setIsCreateUserPasswordFocused(false)}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowCreateUserPassword(!showCreateUserPassword)}
                                >
                                    {showCreateUserPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                            {isCreateUserPasswordFocused && (
                                <div className="absolute top-full left-0 w-full mt-1 z-50">
                                    <PasswordRequirements password={newUserPassword} />
                                </div>
                            )}
                            <PasswordStrengthMeter password={newUserPassword} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCreateUser} disabled={isCreating}>
                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Usuario
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
