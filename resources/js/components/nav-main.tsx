import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage<SharedData>();
    const userPermissions = new Set(page.props.auth.user?.permissions ?? []);
    const userRoles = new Set(page.props.auth.user?.roles ?? []);

    const visibleItems = items.filter((item) => {
        const requiredPermissions = item.permissions ?? [];
        const requiredRoles = item.roles ?? [];

        const hasPermissions =
            requiredPermissions.length === 0 ||
            requiredPermissions.every((permission) =>
                userPermissions.has(permission),
            );

        const hasRoles =
            requiredRoles.length === 0 ||
            requiredRoles.every((role) => userRoles.has(role));

        return hasPermissions && hasRoles;
    });
    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
                {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={page.url.startsWith(
                                typeof item.href === 'string'
                                    ? item.href
                                    : item.href.url,
                            )}
                            tooltip={{ children: item.title }}
                        >
                            <Link href={item.href} prefetch>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
